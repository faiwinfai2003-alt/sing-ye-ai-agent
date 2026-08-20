const personas = [
  {
    id: 1, slug: "sam", name: "阿Sam", gender: "male", tagline: "熱血波經主播",
    description: "充滿活力嘅賽事主播,負責熱情打招呼、推廣賽事同優惠,聲音洪亮有感染力。",
    colorTheme: "gold", avatarUrl: "attached_assets/avatars/sam.png",
    demoAudioUrl: "attached_assets/demo-audio/sam.mp3",
    demoLine: "大家好呀!我係阿Sam,今晚有勁爆賽事直播,仲有新用戶專屬優惠,即刻同我了解吓!",
    voiceName: null, voiceProvider: null, configured: false,
  },
  {
    id: 2, slug: "ken", name: "星爺", gender: "male", tagline: "沉穩VIP客戶經理",
    description: "專業穩重嘅VIP客戶經理,語調平靜有耐性,擅長處理帳戶、存提款等正式查詢。",
    colorTheme: "azure", avatarUrl: "attached_assets/avatars/ken.png",
    demoAudioUrl: "attached_assets/demo-audio/ken.mp3",
    demoLine: "你好,我係你嘅專屬客戶經理星爺,有關你嘅帳戶或者存提款問題,慢慢講,我幫你逐步處理。",
    voiceName: null, voiceProvider: null, configured: false,
  },
  {
    id: 3, slug: "wongchoi", name: "旺財", gender: "male", tagline: "老友鬼鬼街坊客服",
    description: "親切隨和嘅街坊式客服,好似老朋友咁傾偈,適合一般查詢同輕鬆對話。",
    colorTheme: "ember", avatarUrl: "attached_assets/avatars/wongchoi.png",
    demoAudioUrl: "attached_assets/demo-audio/wongchoi.mp3",
    demoLine: "喂!老友,我係旺財,有咩唔識就問我,包你一聽就明,唔使拘泥嘅!",
    voiceName: null, voiceProvider: null, configured: false,
  },
  {
    id: 4, slug: "siusuet", name: "小雪", gender: "female", tagline: "溫柔耐心客服",
    description: "溫柔體貼嘅新手客服,語氣柔和有耐性,最適合帶新用戶了解平台功能。",
    colorTheme: "rose", avatarUrl: "attached_assets/avatars/siusuet.png",
    demoAudioUrl: "attached_assets/demo-audio/siusuet.mp3",
    demoLine: "你好呀,我係小雪,有咩唔明白都可以慢慢同我講,我會耐心幫你解決。",
    voiceName: null, voiceProvider: null, configured: false,
  },
  {
    id: 5, slug: "luna", name: "Luna", gender: "female", tagline: "型格科技女聲",
    description: "型格現代嘅AI數據助理,語氣乾脆有質感,擅長分析賽事數據同精選推薦。",
    colorTheme: "violet", avatarUrl: "attached_assets/avatars/luna.png",
    demoAudioUrl: "attached_assets/demo-audio/luna.mp3",
    demoLine: "你好,我係Luna,由AI數據引擎驅動,可以同你分析賽事數據同介紹平台功能。",
    voiceName: null, voiceProvider: null, configured: false,
  },
  {
    id: 6, slug: "jansir", name: "珍姐", gender: "female", tagline: "爽快高效催單",
    description: "爽快幹練嘅營運專員,語速較快、重點清晰,擅長提醒優惠限時同截止日期。",
    colorTheme: "jade", avatarUrl: "attached_assets/avatars/jansir.png",
    demoAudioUrl: "attached_assets/demo-audio/jansir.mp3",
    demoLine: "喂,我係珍姐,你嘅優惠今晚十二點就過期,快啲上去領取,唔好蝕底呀!",
    voiceName: null, voiceProvider: null, configured: false,
  },
];

export default function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  return res.status(200).json(personas);
}
