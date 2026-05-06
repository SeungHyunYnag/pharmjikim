const express = require("express");
const path = require("path");
const axios = require("axios");
const xml2js = require("xml2js");

const app = express();
const PORT = process.env.PORT || 3000;

// =============================
// static + index
// =============================
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =============================
// API KEY
// =============================
const SERVICE_KEY =
process.env.SERVICE_KEY ||
"3996c6ef0e033bd3cc0ce7f5c51b1d8b08dfea8e210adcfc13072073d08bfc35";

// =============================
// cache
// =============================
let cache = { data: null, time: 0 };
const CACHE_TIME = 1000 * 60 * 10;

// =============================
// API
// =============================
app.get("/api/pharmacies", async (req, res) => {

    try {

        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: "lat/lng 필요" });
        }

        let data;

        if (cache.data && Date.now() - cache.time < CACHE_TIME) {
            data = cache.data;
        } else {
            data = await loadAPI();

            console.log("📦 전체 약국:", data.length);

            cache = { data, time: Date.now() };
        }

        const result = data
            .map(p => {

                const distance = getDistance(lat, lng, p.lat, p.lng);
                const isOpen = checkOpen(p);

                return {
                    name: p.name,
                    addr: p.addr,
                    lat: p.lat,
                    lng: p.lng,
                    tel: p.tel,
                    weekdayStart: p.start,
                    weekdayEnd: p.end,
                    distance,
                    isOpen
                };
            })
            .filter(p => p.distance <= 10);

        console.log("📍 최종:", result.length);

        res.json(result);

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        res.json([]);
    }
});

// =============================
// 공공 API
// =============================
async function loadAPI() {

    try {

        const url =
        `https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyBassInfoInqire` +
        `?serviceKey=${SERVICE_KEY}&numOfRows=1000&pageNo=1`;

        const xml = await axios.get(url);

        const json = await xml2js.parseStringPromise(xml.data);

        const items =
            json?.response?.body?.[0]?.items?.[0]?.item || [];

        return items.map(p => ({
            name: p.dutyName?.[0],
            addr: p.dutyAddr?.[0],
            tel: p.dutyTel1?.[0],

            lat: Number(p.wgs84Lat?.[0]),
            lng: Number(p.wgs84Lon?.[0]),

            start: getTodayStart(p),
            end: getTodayEnd(p)

        }))
        .filter(p => p.lat && p.lng);

    } catch (e) {

        console.error("❌ API 실패:", e.message);

        return [{
            name: "테스트 약국",
            addr: "서울 테스트",
            tel: "000-0000-0000",
            lat: 37.5665,
            lng: 126.9780,
            start: "0900",
            end: "1800"
        }];
    }
}

// =============================
// 요일
// =============================
function getDay(){
    return new Date().getDay();
}

// =============================
// 시작 시간
// =============================
function getTodayStart(p){

    const map = {
        0:"dutyTime7s",
        1:"dutyTime1s",
        2:"dutyTime2s",
        3:"dutyTime3s",
        4:"dutyTime4s",
        5:"dutyTime5s",
        6:"dutyTime6s"
    };

    return p[map[getDay()]]?.[0];
}

// =============================
// 종료 시간
// =============================
function getTodayEnd(p){

    const map = {
        0:"dutyTime7c",
        1:"dutyTime1c",
        2:"dutyTime2c",
        3:"dutyTime3c",
        4:"dutyTime4c",
        5:"dutyTime5c",
        6:"dutyTime6c"
    };

    return p[map[getDay()]]?.[0];
}

// =============================
// 🟢 운영중 판단 (핵심 수정)
// =============================
function checkOpen(p){

    if(!p.start || !p.end) return false;

    let start = parseInt(p.start);
    let end = parseInt(p.end);

    // 🔥 익일 처리 (2400~2500)
    if(end >= 2400){
        end = end - 2400;
    }

    const now = new Date();
    const nowTime = now.getHours()*100 + now.getMinutes();

    return nowTime >= start && nowTime <= end;
}

// =============================
// 거리 계산
// =============================
function getDistance(lat1, lon1, lat2, lon2){

    const R = 6371;

    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;

    const a =
        Math.sin(dLat/2)**2 +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2)**2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// =============================
app.listen(PORT, ()=>{
    console.log("🚀 server running:", PORT);
});
