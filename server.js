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
// static
// =============================
app.use(express.static("public"));

// =============================
// root
// =============================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =============================
// API
// =============================
app.get("/api/pharmacies", async (req, res) => {

    try {

        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: "lat lng 필요" });
        }

        const data = await loadPharmacies();

        const result = data
            .map(p => {

                const distance = getDistance(lat, lng, p.lat, p.lng);

                return {
                    name: p.name,
                    addr: p.addr,
                    lat: p.lat,
                    lng: p.lng,
                    tel: p.tel,
                    weekdayStart: p.weekdayStart,
                    weekdayEnd: p.weekdayEnd,
                    distance
                };
            })
            // 🔥 10km 제한
            .filter(p => p.distance <= 10)
            .sort((a,b)=>a.distance-b.distance);

        res.json(result);

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "server error" });
    }
});

// =============================
// 공공데이터
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
// 거리 계산
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
app.listen(PORT, () => {
    console.log("server running:", PORT);
});
