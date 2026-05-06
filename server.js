const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

// 📁 static 폴더 연결 (index.html용)
app.use(express.static(path.join(__dirname, "public")));

const SERVICE_KEY =
  "3996c6ef0e033bd3cc0ce7f5c51b1d8b08dfea8e210adcfc13072073d08bfc35";

// 📍 약국 API
app.get("/api/pharmacies", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const url =
      "https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyLcinfoInqire";

    const response = await axios.get(url, {
      params: {
        serviceKey: SERVICE_KEY,
        WGS84_LON: lng,
        WGS84_LAT: lat,
        numOfRows: 100,
        pageNo: 1,
      },
    });

    const items = response.data?.response?.body?.items?.item || [];

    const result = items.map((p) => ({
      name: p.dutyName,
      lat: p.latitude,
      lng: p.longitude,
      tel: p.dutyTel1,
      addr: p.dutyAddr,
      start: p.startTime,
      end: p.endTime,
      distance: p.distance,
    }));

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      error: "API 오류",
      detail: err.message,
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
