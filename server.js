const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const PUBLIC_KEY = "3996c6ef0e033bd3cc0ce7f5c51b1d8b08dfea8e210adcfc13072073d08bfc35";
const SEOUL_KEY = "4d754d515773616d35387343596568";

const PHARMACY_API =
"https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyLcinfoInqire";

const SEOUL_API =
`http://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json/TbPharmacyOperateInfo/1/1000/`;

/* ------------------------------
   서울 데이터
------------------------------ */
async function getSeoulData(){
    try {
        const res = await axios.get(SEOUL_API);
        return res.data?.TbPharmacyOperateInfo?.row || [];
    } catch {
        return [];
    }
}

/* ------------------------------
   공공 약국 데이터
------------------------------ */
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

/* ------------------------------
   이름 정리
------------------------------ */
function normalize(n){
    return (n || "").replace(/\s/g,"").replace(/\(.*?\)/g,"");
}

/* ------------------------------
   MERGE
------------------------------ */
function merge(national, seoul){

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

            // 🔥 운영시간 (서울 API)
            weekdayStart: s?.MON_START || null,
            weekdayEnd: s?.MON_END || null,
            saturdayStart: s?.SAT_START || null,
            saturdayEnd: s?.SAT_END || null,
            holidayOpen: s?.HOLIDAY_YN || "N"
        };
    });
}

/* ------------------------------
   OPEN / CLOSE
------------------------------ */
function toTime(t){
    if(!t) return null;
    return parseInt(t);
}

function isOpen(p){

    const now = new Date();
    const day = now.getDay();
    const time = now.getHours()*100 + now.getMinutes();

    const start = toTime(p.weekdayStart);
    const end = toTime(p.weekdayEnd);

    if(!start || !end) return true;

    if(day === 0){
        return p.holidayOpen === "Y";
    }

    if(day === 6){
        return time >= toTime(p.saturdayStart || start) &&
               time <= toTime(p.saturdayEnd || end);
    }

    return time >= start && time <= end;
}

/* ------------------------------
   API
------------------------------ */
app.get("/api/pharmacies", async (req,res)=>{

    const { lat, lng } = req.query;

    const [national, seoul] = await Promise.all([
        getPharmacyData(lat,lng),
        getSeoulData()
    ]);

    const merged = merge(national, seoul);

    const result = merged.map(p => ({
        ...p,
        isOpen: isOpen(p)
    }));

    res.json(result);
});

/* ------------------------------
   START
------------------------------ */
app.listen(PORT, ()=>{
    console.log("server running:", PORT);
});
