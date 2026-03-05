const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

// ============ CORS Configuration للإنتاج ============
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://drdoaa.netlify.app", // استبدل برابط Netlify بعد الرفع
    "https://drdoaa-api.onrender.com", // استبدل برابط Render بعد الرفع
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static(__dirname)); // خدمة الملفات الثابتة من نفس المجلد

// توجيه الرابط الرئيسي لـ index.html
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// ============ MongoDB Connection ============
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB Atlas");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// ============ Schema ============

// Schema للفيديوهات
const videoSchema = new mongoose.Schema({
  seasonId: Number,
  number: Number,
  title: String,
  youtubeId: String,
  duration: String,
  description: String,
});

const Video = mongoose.model("Video", videoSchema);

// Schema للمواسم
const seasonSchema = new mongoose.Schema({
  seasonId: { type: Number, unique: true },
  title: String,
  subtitle: String,
  badge: String,
});

const Season = mongoose.model("Season", seasonSchema);

// ============ APIs إدارة المواسم (الجديدة) ============

// POST: إضافة موسم جديد
app.post("/api/seasons", async (req, res) => {
  try {
    const { title, subtitle, badge } = req.body;

    // الحصول على أعلى seasonId
    const lastSeason = await Season.findOne().sort({ seasonId: -1 });
    const newSeasonId = lastSeason ? lastSeason.seasonId + 1 : 4;

    const newSeason = new Season({
      seasonId: newSeasonId,
      title: title || `Season ${newSeasonId}`,
      subtitle: subtitle || "New Season",
      badge: badge || `Season ${newSeasonId}`,
    });

    await newSeason.save();
    res.status(201).json(newSeason);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT: تعديل موسم
app.put("/api/seasons/:seasonId", async (req, res) => {
  try {
    const season = await Season.findOne({
      seasonId: parseInt(req.params.seasonId),
    });
    if (!season) {
      return res.status(404).json({ error: "Season not found" });
    }

    season.title = req.body.title || season.title;
    season.subtitle = req.body.subtitle || season.subtitle;
    season.badge = req.body.badge || season.badge;

    await season.save();
    res.json(season);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE: حذف موسم
app.delete("/api/seasons/:seasonId", async (req, res) => {
  try {
    const seasonId = parseInt(req.params.seasonId);

    // منع حذف المواسم الأساسية (1,2,3)
    if (seasonId <= 3) {
      return res.status(403).json({ error: "Cannot delete default seasons" });
    }

    // التحقق من وجود فيديوهات في هذا الموسم
    const videosCount = await Video.countDocuments({ seasonId });
    if (videosCount > 0) {
      return res.status(400).json({
        error: "Cannot delete season with videos. Delete videos first.",
      });
    }

    const result = await Season.deleteOne({ seasonId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Season not found" });
    }

    res.json({ message: "Season deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ APIs الفيديوهات (الموجودة) ============

// GET: كل المواسم
app.get("/api/seasons", async (req, res) => {
  try {
    const seasons = await Season.find().sort({ seasonId: 1 });
    res.json(seasons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: بيانات موسم معين
app.get("/api/seasons/:seasonId", async (req, res) => {
  try {
    const season = await Season.findOne({
      seasonId: parseInt(req.params.seasonId),
    });
    if (!season) {
      return res.status(404).json({ error: "Season not found" });
    }
    res.json(season);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: فيديوهات موسم معين
app.get("/api/seasons/:seasonId/videos", async (req, res) => {
  try {
    const videos = await Video.find({
      seasonId: parseInt(req.params.seasonId),
    }).sort({ number: 1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: إضافة فيديو جديد
app.post("/api/videos", async (req, res) => {
  try {
    const video = new Video(req.body);
    await video.save();
    res.status(201).json(video);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT: تعديل فيديو
app.put("/api/videos/:id", async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(video);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE: حذف فيديو
app.delete("/api/videos/:id", async (req, res) => {
  try {
    await Video.findByIdAndDelete(req.params.id);
    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: الإحصائيات
app.get("/api/stats", async (req, res) => {
  try {
    const totalVideos = await Video.countDocuments();
    const totalSeasons = await Season.countDocuments();

    // حساب إجمالي الساعات
    const videos = await Video.find();
    let totalMinutes = 0;
    videos.forEach((v) => {
      if (v.duration) {
        const parts = v.duration.split(":");
        if (parts.length === 2) {
          totalMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else if (parts.length === 3) {
          totalMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
    });

    const totalHours = (totalMinutes / 60).toFixed(1);

    res.json({
      totalVideos,
      totalSeasons,
      totalHours: totalHours + "h",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: التحقق من كلمة السر
app.post("/api/check-password", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (password === adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Wrong password" });
  }
});

// ============ Initialize Database ============
async function initDatabase() {
  try {
    // إضافة المواسم إذا لم تكن موجودة
    const seasonsCount = await Season.countDocuments();
    if (seasonsCount === 0) {
      await Season.insertMany([
        {
          seasonId: 1,
          title: "Season 1",
          subtitle: "Introduction to Israeli Science",
          badge: "Season 1",
        },
        {
          seasonId: 2,
          title: "Season 2",
          subtitle: "Modern Israeli",
          badge: "Season 2",
        },
        {
          seasonId: 3,
          title: "Season 3",
          subtitle: "Coming Soon...",
          badge: "Season 3",
        },
      ]);

      // إضافة فيديوهات Season 1
      const season1Videos = [
        {
          seasonId: 1,
          number: 1,
          title: "الرد على مزاعم هيكل سليمان",
          youtubeId: "BQqMKXTpO6g",
          duration: "27:58",
          description:
            "تحليل علمي مفصل للرد على الادعاءات التاريخية حول هيكل سليمان مع عرض الأدلة الأثرية والدينية.",
        },
        {
          seasonId: 1,
          number: 2,
          title: "المجتمع الإسرائيلي والهجرة العكسية",
          youtubeId: "pqIkKs4j55E",
          duration: "25:57",
          description:
            "دراسة تحليلية لظاهرة الهجرة العكسية من إسرائيل وأثرها على المجتمع الإسرائيلي.",
        },
        {
          seasonId: 1,
          number: 3,
          title: "كيف يرود رواد الصهيونية",
          youtubeId: "jFdhlb4Gzqo",
          duration: "24:07",
          description:
            "تحليل تاريخي لخطط الحركة الصهيونية في السيطرة على الأرض عبر العقود.",
        },
        {
          seasonId: 1,
          number: 4,
          title: "حرب أكتوبر المجيدة",
          youtubeId: "600RDEAuFCU",
          duration: "16:14",
          description:
            "عرض الرواية الإسرائيلية لحرب أكتوبر وتحليل أسباب الهزيمة من وجهة نظر إسرائيلية.",
        },
        {
          seasonId: 1,
          number: 5,
          title: "من هو بنيامين نتنياهو",
          youtubeId: "At4iKPnxfME",
          duration: "23:51",
          description:
            "سيرة ذاتية تحليلية لأطول رئيس وزراء في تاريخ إسرائيل وأبرز محطات حياته السياسية.",
        },
        {
          seasonId: 1,
          number: 6,
          title: "قضايا المثلية والاغتصاب في إسرائيل",
          youtubeId: "O7SoHAH-L-0",
          duration: "22:32",
          description:
            "تحليل اجتماعي لظاهرة العنف الجنسي وقضايا المثليين في المجتمع الإسرائيلي.",
        },
        {
          seasonId: 1,
          number: 7,
          title: "أسباب رفض الشعوب الأوروبية لليهود وعلاقته بحرب غزة الآن",
          youtubeId: "vu9JGXY2Nzo",
          duration: "30:24",
          description:
            "دراسة تاريخية لأسباب معاداة السامية في أوروبا وارتباطها بالأحداث الجارية في غزة.",
        },
        {
          seasonId: 1,
          number: 8,
          title: "من هي دعاء سيف الدين",
          youtubeId: "kxRELhFvj3I",
          duration: "27:28",
          description:
            "سيرة ذاتية للدكتورة دعاء سيف الدين ورحلتها الأكاديمية في دراسة اللغة العبرية.",
        },
        {
          seasonId: 1,
          number: 9,
          title: "قمة القمة",
          youtubeId: "tabhDbi1NUI",
          duration: "27:04",
          description:
            "تحليل لأهم القمم العربية والإسرائيلية وتأثيرها على الصراع في الشرق الأوسط.",
        },
        {
          seasonId: 1,
          number: 10,
          title:
            "الحلقة الأولى: كتاب اللوبي الإسرائيلي والسياسة الخارجية الأمريكية",
          youtubeId: "J1ay0Nxe13s",
          duration: "10:41",
          description:
            "قراءة في كتاب اللوبي الإسرائيلي وتأثيره على صناعة القرار في السياسة الخارجية الأمريكية.",
        },
        {
          seasonId: 1,
          number: 11,
          title: "فلسطين وقرار الاعتراف بها",
          youtubeId: "en86GKbn6R0",
          duration: "8:03",
          description:
            "تحليل للجهود الدولية للاعتراف بدولة فلسطين وتداعياتها على الصراع.",
        },
        {
          seasonId: 1,
          number: 12,
          title: "كنوز القدس",
          youtubeId: "1dHcQ3-IM5g",
          duration: "7:46",
          description:
            "جولة في معالم القدس التاريخية والدينية وأهميتها في الصراع الفلسطيني الإسرائيلي.",
        },
        {
          seasonId: 1,
          number: 13,
          title: "قراءة كتاب اللوبي الإسرائيلي مع الإعلامي أسامة الدليل",
          youtubeId: "Hy0SGf-uL7M",
          duration: "8:20",
          description:
            "حوار مع الإعلامي أسامة الدليل حول كتاب اللوبي الإسرائيلي وأهميته.",
        },
        {
          seasonId: 1,
          number: 14,
          title: "يهود إثيوبيا",
          youtubeId: "M6qwPYn1gPA",
          duration: "7:49",
          description:
            "قصة يهود الفلاشا في إثيوبيا وهجرتهم إلى إسرائيل وتحديات الاندماج.",
        },
        {
          seasonId: 1,
          number: 15,
          title: "الماسونية",
          youtubeId: "mVKHIrmFLu8",
          duration: "9:16",
          description:
            "تحليل للعلاقة بين الحركة الماسونية والصهيونية وتأثيرها على المنطقة.",
        },
        {
          seasonId: 1,
          number: 16,
          title: "جولدا مائير",
          youtubeId: "7lYzNBg1GfA",
          duration: "19:29",
          description:
            "سيرة أول امرأة تتولى رئاسة الوزراء في إسرائيل وأبرز قراراتها في حرب أكتوبر.",
        },
      ];

      await Video.insertMany(season1Videos);

      // إضافة فيديوهات Season 2
      const season2Videos = [
        {
          seasonId: 2,
          number: 1,
          title: "جولدا وحرب اكتوبر الجزء 1",
          youtubeId: "TPI3vRyGV20",
          duration: "1:39",
          description: "تحليل دور جولدا مائير في حرب أكتوبر - الجزء الأول.",
        },
        {
          seasonId: 2,
          number: 2,
          title: "جولدا وحرب اكتوبر الجزء 2",
          youtubeId: "ekulnREH8S4",
          duration: "1:36",
          description: "تحليل دور جولدا مائير في حرب أكتوبر - الجزء الثاني.",
        },
        {
          seasonId: 2,
          number: 3,
          title: "حصاد الموسم الأول",
          youtubeId: "4YEwbiwr3G8",
          duration: "3:08",
          description:
            "مراجعة شاملة لأهم المواضيع التي تم تناولها في الموسم الأول.",
        },
        {
          seasonId: 2,
          number: 4,
          title: "مخطط الشرق الأوسط الجديد",
          youtubeId: "kWjeny2Oea0",
          duration: "11:19",
          description:
            "تحليل للمخططات الإسرائيلية والأمريكية لإعادة تشكيل الشرق الأوسط.",
        },
        {
          seasonId: 2,
          number: 5,
          title: "كيف تخطط إسرائيل لإسقاط إيران",
          youtubeId: "MZ7zfr0vbnY",
          duration: "10:06",
          description:
            "استراتيجيات إسرائيلية محتملة للتعامل مع الملف النووي الإيراني.",
        },
        {
          seasonId: 2,
          number: 6,
          title: "نظرة الاستشراق للإسلام",
          youtubeId: "VN3jiQ_uLRc",
          duration: "10:23",
          description:
            "تحليل نقدي لكيفية تناول المستشرقين الغربيين للدين الإسلامي.",
        },
      ];

      await Video.insertMany(season2Videos);
      console.log("✅ Database initialized with seasons and videos");
    }
  } catch (error) {
    console.error("❌ Error initializing database:", error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
    await initDatabase();
});
