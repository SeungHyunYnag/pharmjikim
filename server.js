const express = require("express");
const axios = require("axios");
const xml2js = require("xml2js");

const app = express();
const PORT = process.env.PORT || 3000;

const SERVICE_KEY = "3996c6ef0e033bd3cc0ce7f5c51b1d8b08dfea8e210adcfc13072073d08bfc35";

const API_URL =
"https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyBassInfoInqire";

app.get("/api/test", async (req, res) => {

    try {

        const { lat, lng } = req.query;

        const response = await axios.get(API_URL, {
            params: {
                serviceKey: SERVICE_KEY,
                WGS84_LAT: lat,
                WGS84_LON: lng,
                numOfRows: 10,
                pageNo: 1
            }
        });

        // 🔥 원본 XML 확인
        console.log("RAW XML:", response.data.substring(0,200));

        const parsed = await xml2js.parseStringPromise(response.data, {
            explicitArray: false
        });

        let items = parsed?.response?.body?.items?.item;

        // 🔥 핵심: 배열 보정
        if (!items) items = [];
        if (!Array.isArray(items)) items = [items];

        // 🔥 최소 데이터만 반환
        const result = items.map(p => ({
            name: p.dutyName,
            addr: p.dutyAddr,
            lat: p.wgs84Lat,
            lng: p.wgs84Lon
        }));

        res.json(result);

    } catch (e) {

        console.error("🔥 ERROR:", e.message);

        res.status(500).json({
            error: "FAIL",
            detail: e.message
        });
    }
});

app.listen(PORT, () => {
    console.log("🚀 server start:", PORT);
});
