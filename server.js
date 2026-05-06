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
const PUBLIC_KEY = "3996c6ef0e033bd3cc0ce7f5c51b1d8b08dfea8e210adcfc13072073d08bfc35";
const SEOUL_KEY = "4d754d515773616d35387343596568";

/* ------------------------------------
   📍 공공 API (약국 위치)
------------------------------------ */
const PHARMACY_API =
"https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyLcinfoInqire";

/* ------------------------------------
   🏙 서울 API (운영시간)
------------------------------------ */
const SEOUL_API =
`http://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json/TbPharmacyOperateInfo/1/1000/`;

/* ------------------------------------
   🔥 서울 데이터
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
   🔥 공공 약국 데이터
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
   🔧 이름 정규화 (핵심)
------------------------------------ */
function normalize(name){
    if(!name) return "";
    return name.replace(/\s/g,"").replace(/\(.*?\)/g,"");
}

/* ------------------------------------
   🔥 MERGE (핵심 수정)
------------------------------------ */
function mergeData(national, seoul){

    return national.map(p => {

        const s = seoul.find(x =>
            normalize(x.PHARM_NM) === normalize(p.dutyName)
        );

        return {
            name: p.dutyName,
            lat: Number(p.latitude),
            lng: Number(p.longitude),
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
   🔥 시간 변환
------------------------------------ */
function parseTime(t){
    if(!t) return null;
    return parseInt(t);
}

/* ------------------------------------
   🕒 OPEN / CLOSE (안전 버전)
------------------------------------ */
function isOpen(p){

    const now = new Date();
    const day = now.getDay();
    const time = now.getHours()*100 + now.getMinutes();

    const start = parseTime(p.weekdayStart);
    const end = parseTime(p.weekdayEnd);

    // 데이터 없으면 unknown → false 처리 대신 true로 변경 가능
    if(!start || !end) return true;

    if(day === 0){
        return p.holidayOpen === "Y";
    }

    if(day === 6){
        return time >= parseTime(p.saturdayStart || start) &&
               time <= parseTime(p.saturdayEnd || end);
    }

    return time >= start && time <= end;
}

/* ------------------------------------
   🌐 API
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
   🚀 SERVER
------------------------------------ */
app.listen(PORT, ()=>{
    console.log("🚀 server running:", PORT);
});
