const express = require("express");
const xml2js = require("xml2js");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 공공데이터 키
const SERVICE_KEY =
process.env.SERVICE_KEY ||
"3996c6ef0e033bd3cc0ce7f5c51b1d8b08dfea8e210adcfc13072073d08bfc35";

// =============================
// 📦 public 폴더 정적 서빙 (핵심)
// =============================
app.use(express.static("public"));

// =============================
// 📍 API
// =============================
let cache = { data:null, time:0 };
const CACHE_TIME = 1000 * 60 * 10;

app.get("/api/pharmacies", async (req, res) => {

    try {

        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: "lat lng 필요" });
        }

        let data;

        if (cache.data && Date.now() - cache.time < CACHE_TIME) {
            data = cache.data;
        } else {
            data = await loadPharmacies();
            cache = { data, time: Date.now() };
        }

        const result = data
            .map(p => {

                const distance = getDistance(lat, lng, p.lat, p.lng);
                const isOpen = checkOpen(p.raw);

                return {
                    name: p.name,
                    addr: p.addr,
                    lat: p.lat,
                    lng: p.lng,
                    tel: p.tel,
                    weekdayStart: p.weekdayStart,
                    weekdayEnd: p.weekdayEnd,
                    isOpen,
                    distance
                };
            })
            .filter(p => p.distance <= 1 && p.isOpen)
            .sort((a,b)=>a.distance-b.distance);

        res.json(result);

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "server error" });
    }
});

// =============================
// 📦 공공데이터
// =============================
async function loadPharmacies() {

    const url =
    `https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyBassInfoInqire` +
    `?serviceKey=${SERVICE_KEY}&numOfRows=1000&pageNo=1`;

    const xml = await fetch(url).then(r => r.text());
    const json = await xml2js.parseStringPromise(xml);

    const items =
        json?.response?.body?.[0]?.items?.[0]?.item || [];

    return items.map(p => ({

        name: p.dutyName?.[0],
        addr: p.dutyAddr?.[0],
        tel: p.dutyTel1?.[0],

        lat: Number(p.wgs84Lat?.[0]),
        lng: Number(p.wgs84Lon?.[0]),

        weekdayStart: p.dutyTime1s?.[0],
        weekdayEnd: p.dutyTime1c?.[0],

        raw: p
    }))
    .filter(p => p.lat && p.lng);
}

// =============================
// 🟢 운영중 판단
// =============================
function checkOpen(p) {

    const now = new Date();
    const day = now.getDay();

    const map = {
        1:["dutyTime1s","dutyTime1c"],
        2:["dutyTime2s","dutyTime2c"],
        3:["dutyTime3s","dutyTime3c"],
        4:["dutyTime4s","dutyTime4c"],
        5:["dutyTime5s","dutyTime5c"],
        6:["dutyTime6s","dutyTime6c"],
        0:["dutyTime7s","dutyTime7c"]
    };

    const [sKey,cKey] = map[day] || [];

    const start = p[sKey]?.[0];
    const end = p[cKey]?.[0];

    if(!start || !end) return false;

    const nowNum = now.getHours()*100 + now.getMinutes();

    return nowNum >= Number(start) && nowNum <= Number(end);
}

// =============================
// 📏 거리 계산
// =============================
function getDistance(lat1, lon1, lat2, lon2) {

    const R = 6371;

    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;

    const a =
        Math.sin(dLat/2)**2 +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2)**2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// =============================
// 🚀 서버 실행
// =============================
app.listen(PORT, () => {
    console.log("server running:", PORT);
});
