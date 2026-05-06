const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const xml2js = require("xml2js");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

/* 🔑 인증키 */
const SERVICE_KEY = "3996c6ef0e033bd3cc0ce7f5c51b1d8b08dfea8e210adcfc13072073d08bfc35";

/* 🔥 약국 API */
const PHARMACY_API =
"https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyBassInfoInqire";

/* 🔥 공휴일 API */
const HOLIDAY_API =
"https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

/* -----------------------------
   공휴일 확인 (월 1번 호출)
----------------------------- */
async function checkHoliday(){

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth()+1).padStart(2,"0");
    const today = now.toISOString().slice(0,10).replace(/-/g,"");

    try{

        const res = await axios.get(HOLIDAY_API,{
            params:{
                serviceKey:SERVICE_KEY,
                solYear:year,
                solMonth:month
            }
        });

        const json = await xml2js.parseStringPromise(res.data,{
            explicitArray:false
        });

        const items = json?.response?.body?.items?.item;

        if(!items) return false;

        const list = Array.isArray(items) ? items : [items];

        return list.some(d => d.locdate == today);

    }catch(e){
        console.log("공휴일 API 오류");
        return false;
    }
}

/* -----------------------------
   약국 데이터
----------------------------- */
async function getPharmacy(lat,lng){

    const res = await axios.get(PHARMACY_API,{
        params:{
            serviceKey:SERVICE_KEY,
            pageNo:1,
            numOfRows:100,
            WGS84_LAT:lat,
            WGS84_LON:lng
        }
    });

    const json = await xml2js.parseStringPromise(res.data,{
        explicitArray:false
    });

    return json?.response?.body?.items?.item || [];
}

/* -----------------------------
   오늘 시간 추출
----------------------------- */
function getTodayTime(p, isHoliday){

    if(isHoliday){
        return {
            start: p.dutyTime8s || null,
            end: p.dutyTime8c || null
        };
    }

    const day = new Date().getDay();

    const map = {
        0:["dutyTime7s","dutyTime7c"], // 일
        1:["dutyTime1s","dutyTime1c"],
        2:["dutyTime2s","dutyTime2c"],
        3:["dutyTime3s","dutyTime3c"],
        4:["dutyTime4s","dutyTime4c"],
        5:["dutyTime5s","dutyTime5c"],
        6:["dutyTime6s","dutyTime6c"]
    };

    const [s,c] = map[day];

    return {
        start: p[s] || null,
        end: p[c] || null
    };
}

/* -----------------------------
   OPEN 판단 (🔥 2500 처리 핵심)
----------------------------- */
function isOpen(start,end){

    if(!start || !end) return false; // 휴무

    const now = new Date();
    const nowTime = now.getHours()*100 + now.getMinutes();

    let s = parseInt(start);
    let e = parseInt(end);

    // 🔥 2500 → 다음날
    if(e > 2400){
        e = e - 2400;
        return (nowTime >= s || nowTime <= e);
    }

    return nowTime >= s && nowTime <= e;
}

/* -----------------------------
   API
----------------------------- */
app.get("/api/pharmacies", async (req,res)=>{

    try{

        const { lat,lng } = req.query;

        // 🔥 공휴일 1번만 호출
        const holiday = await checkHoliday();

        const data = await getPharmacy(lat,lng);

        const result = data.map(p=>{

            const t = getTodayTime(p, holiday);

            return {
                name:p.dutyName,
                addr:p.dutyAddr,
                tel:p.dutyTel1,
                lat:Number(p.wgs84Lat),
                lng:Number(p.wgs84Lon),

                weekdayStart:t.start,
                weekdayEnd:t.end,

                isOpen:isOpen(t.start,t.end)
            };
        });

        res.json(result);

    }catch(e){
        console.error(e);
        res.status(500).json({error:"server error"});
    }
});

app.listen(PORT,()=>{
    console.log("🚀 server running:",PORT);
});
