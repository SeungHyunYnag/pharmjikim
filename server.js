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
// 📦 static
// =============================
app.use(express.static("public"));

// =============================
// 🏠 root
// =============================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =============================
// 📍 API (🔥 필터 제거 핵심)
// =============================
app.get("/api/pharmacies", async (req, res) => {

    try {

        let data = await loadPharmacies();

        const result = data.map(p => ({
            name: p.name,
            addr: p.addr,
            lat: p.lat,
            lng: p.lng,
            tel: p.tel,
            weekdayStart: p.weekdayStart,
            weekdayEnd: p.weekdayEnd,
            isOpen: true, // 🔥 일단 무조건 true (테스트용)
            distance: 0
        }));

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
// 🚀 start
// =============================
app.listen(PORT, () => {
    console.log("server running:", PORT);
});
