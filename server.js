const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

/* ------------------------------------
   🔑 API KEY
------------------------------------ */
const PUBLIC_KEY =
"3996c6ef0e033bd3cc0ce7f5c51b1d8b08dfea8e210adcfc13072073d08bfc35";

const SEOUL_KEY =
"4d754d515773616d35387343596568";

/* ------------------------------------
   📍 공공 약국 위치 API
------------------------------------ */
const PHARMACY_API =
"https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyLcinfoInqire";

/* ------------------------------------
   🏙 서울 약국 운영시간 API
------------------------------------ */
const SEOUL_API =
`http://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json/TbPharmacyOperateInfo/1/1000/`;

/* ------------------------------------
   📦 서울 데이터
------------------------------------ */
async function getSeoulData(){
    try {
        const res = await axios.get(SEOUL_API);
        return res.data?.TbPharmacyOperateInfo?.row || [];
    } catch (e) {
        console.log("서울 API 실패:", e.message);
        return [];
    }
}

/* ------------------------------------
   📦 공공 약국 데이터
------------------------------------ */
async function getPharmacyData(lat,lng){

    const res = await axios.get(PHARMACY_API, {
        params: {
            serviceKey: PUBLIC_KEY,
            WGS84_LAT: lat,
            WGS84_LON: lng,
            numOfRows: 100,
            pageNo: 1
        }
    });

    return res.data?.response?.body?.items?.item || [];
}

/* ------------------------------------
   🔥 MERGE (핵심)
------------------------------------ */
function mergeData(national, seoul){

    return national.map(p => {

        const s = seoul.find(x =>
            x.PHARM_NM === p.dutyName
        );

        return {
            name: p.dutyName,
            lat: p.latitude,
            lng: p.longitude,
            addr: p.dutyAddr,
            tel: p.dutyTel1,

            weekdayStart: s?.MON_START,
            weekdayEnd: s?.MON_END,
            saturdayStart: s?.SAT_START,
            saturdayEnd: s?.SAT_END,
            holidayOpen: s?.HOLIDAY_YN || "N"
        };
    });
}

/* ------------------------------------
   🕒 OPEN / CLOSE 판단
------------------------------------ */
function isOpen(p){

    const now = new Date();
    const day = now.getDay();
    const time = now.getHours()*100 + now.getMinutes();

    if(day === 0){
        return p.holidayOpen === "Y";
    }

    if(day === 6){
        return time >= p.saturdayStart && time <= p.saturdayEnd;
    }

    return time >= p.weekdayStart && time <= p.weekdayEnd;
}

/* ------------------------------------
   🌐 API (프론트)
------------------------------------ */
app.get("/api/pharmacies", async (req,res)=>{

    try {

        const { lat, lng } = req.query;

        const [national, seoul] = await Promise.all([
            getPharmacyData(lat,lng),
            getSeoulData()
        ]);

        const merged = mergeData(national, seoul);

        const result = merged.map(p => ({
            ...p,
            isOpen: isOpen(p)
        }));

        res.json(result);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ------------------------------------
   🚀 서버 실행
------------------------------------ */
app.listen(PORT, ()=>{
    console.log("🚀 server running on port", PORT);
});
