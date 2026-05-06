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

/* -----------------------------
   🔥 서울 데이터 (전체 로딩)
----------------------------- */
async function getSeoulData(){

    let all = [];
    let start = 1;
    const step = 1000;

    while(true){

        const url =
        `https://openapi.seoul.go.kr:8088/${SEOUL_KEY}/json/TbPharmacyOperateInfo/${start}/${start+step-1}/`;

        const res = await axios.get(url).catch(()=>null);

        if(!res) break;

        const rows = res.data?.TbPharmacyOperateInfo?.row || [];

        if(rows.length === 0) break;

        all = all.concat(rows);

        if(rows.length < step) break;

        start += step;
    }

    console.log("서울 데이터 수:", all.length);

    return all;
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
        .replace(/약국/g,"")
        .toLowerCase();
}

/* -----------------------------
   🔥 오늘 운영시간 추출
----------------------------- */
function getTodayTime(s){

    if(!s) return { start:null, end:null };

    const day = new Date().getDay();

    const startMap = [
        "DUTYTIME7S",
        "DUTYTIME1S",
        "DUTYTIME2S",
        "DUTYTIME3S",
        "DUTYTIME4S",
        "DUTYTIME5S",
        "DUTYTIME6S"
    ];

    const endMap = [
        "DUTYTIME7C",
        "DUTYTIME1C",
        "DUTYTIME2C",
        "DUTYTIME3C",
        "DUTYTIME4C",
        "DUTYTIME5C",
        "DUTYTIME6C"
    ];

    return {
        start: s[startMap[day]] || null,
        end: s[endMap[day]] || null
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

    try{

        const { lat, lng } = req.query;

        const national = await getPharmacyData(lat,lng);
        const seoul = await getSeoulData();

        const merged = merge(national, seoul);

        res.json(
            merged.map(p => ({
                ...p,
                isOpen: isOpen(p)
            }))
        );

    }catch(e){
        console.error("🔥 서버 에러:", e.message);
        res.status(500).json({ error: "server error" });
    }
});

app.listen(PORT, ()=>{
    console.log("🚀 server running:", PORT);
});
