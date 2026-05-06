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

/* -----------------------------
   서울 데이터
----------------------------- */
async function getSeoulData(){
    try {
        const res = await axios.get(SEOUL_API);
        return res.data?.TbPharmacyOperateInfo?.row || [];
    } catch {
        return [];
    }
}

/* -----------------------------
   공공 데이터
----------------------------- */
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

/* -----------------------------
   이름 정규화
----------------------------- */
function normalize(n){
    return (n || "")
        .replace(/\s/g,"")
        .replace(/\(.*?\)/g,"")
        .toLowerCase();
}

/* -----------------------------
   🔥 오늘 요일 기준 시간 추출
----------------------------- */
function getTodayTime(s){

    if(!s) return { start:null, end:null };

    const day = new Date().getDay();

    if(day === 0){ // 일요일
        return {
            start: s.DUTYTIME7S || null,
            end: s.DUTYTIME7C || null
        };
    }

    const map = {
        1: [s.DUTYTIME1S, s.DUTYTIME1C],
        2: [s.DUTYTIME2S, s.DUTYTIME2C],
        3: [s.DUTYTIME3S, s.DUTYTIME3C],
        4: [s.DUTYTIME4S, s.DUTYTIME4C],
        5: [s.DUTYTIME5S, s.DUTYTIME5C],
        6: [s.DUTYTIME6S, s.DUTYTIME6C],
    };

    return {
        start: map[day]?.[0] || null,
        end: map[day]?.[1] || null
    };
}

/* -----------------------------
   MERGE
----------------------------- */
function merge(national, seoul){

    return national.map(p => {

        const s = seoul.find(x => {
            const a = normalize(x.DUTYNAME);
            const b = normalize(p.dutyName);
            return a.includes(b) || b.includes(a);
        });

        const today = getTodayTime(s);

        return {
            name: p.dutyName,
            lat: Number(p.latitude),
            lng: Number(p.longitude),
            addr: p.dutyAddr,
            tel: p.dutyTel1,

            weekdayStart: today.start,
            weekdayEnd: today.end
        };
    });
}

/* -----------------------------
   OPEN 판단
----------------------------- */
function isOpen(p){

    if(!p.weekdayStart || !p.weekdayEnd) return true;

    const now = new Date();
    const time = now.getHours()*100 + now.getMinutes();

    const start = parseInt(p.weekdayStart);
    const end = parseInt(p.weekdayEnd);

    return time >= start && time <= end;
}

/* -----------------------------
   API
----------------------------- */
app.get("/api/pharmacies", async (req,res)=>{

    const { lat, lng } = req.query;

    const [national, seoul] = await Promise.all([
        getPharmacyData(lat,lng),
        getSeoulData()
    ]);

    const merged = merge(national, seoul);

    res.json(
        merged.map(p => ({
            ...p,
            isOpen: isOpen(p)
        }))
    );
});

app.listen(PORT, ()=>{
    console.log("🚀 server running:", PORT);
});
