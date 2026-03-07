const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CORS Configuration (Pxxl Only) ============
const corsOptions = {
  origin: [
    'https://drdoaa-website.pxxl.click',
    'https://drdoaaapi-rhj0f77p.b4a.run',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============ Middleware ============
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ============ Routes ============
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// ============ MongoDB Connection ============
console.log('🔄 Connecting to MongoDB Atlas...');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch(err => console.error("❌ MongoDB connection error:", err.message));

// MongoDB connection events
mongoose.connection.on('connected', () => console.log('✅ Mongoose connected'));
mongoose.connection.on('error', (err) => console.error('❌ Mongoose error:', err));
mongoose.connection.on('disconnected', () => console.log('🔌 Mongoose disconnected'));

// ============ Schemas ============
const videoSchema = new mongoose.Schema({
  seasonId: Number,
  number: Number,
  title: String,
  youtubeId: String,
  duration: String,
  description: String,
}, { timestamps: true });

const seasonSchema = new mongoose.Schema({
  seasonId: { type: Number, unique: true },
  title: String,
  subtitle: String,
  badge: String,
}, { timestamps: true });

const Video = mongoose.model("Video", videoSchema);
const Season = mongoose.model("Season", seasonSchema);

// ============ API Routes ============

// GET all seasons
app.get("/api/seasons", async (req, res) => {
  try {
    const seasons = await Season.find().sort({ seasonId: 1 });
    res.json(seasons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET specific season
app.get("/api/seasons/:seasonId", async (req, res) => {
  try {
    const season = await Season.findOne({ seasonId: parseInt(req.params.seasonId) });
    if (!season) return res.status(404).json({ error: "Season not found" });
    res.json(season);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET videos by season
app.get("/api/seasons/:seasonId/videos", async (req, res) => {
  try {
    const videos = await Video.find({ seasonId: parseInt(req.params.seasonId) }).sort({ number: 1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new video
app.post("/api/videos", async (req, res) => {
  try {
    const video = new Video(req.body);
    await video.save();
    res.status(201).json(video);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update video
app.put("/api/videos/:id", async (req, res) => {
  try {
    const video = await Video.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!video) return res.status(404).json({ error: "Video not found" });
    res.json(video);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE video
app.delete("/api/videos/:id", async (req, res) => {
  try {
    const video = await Video.findByIdAndDelete(req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });
    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET stats
app.get("/api/stats", async (req, res) => {
  try {
    const totalVideos = await Video.countDocuments();
    const totalSeasons = await Season.countDocuments();
    
    const videos = await Video.find();
    let totalMinutes = 0;
    videos.forEach(v => {
      if (v.duration) {
        const parts = v.duration.split(":");
        if (parts.length === 2) {
          totalMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
      }
    });
    
    const totalHours = (totalMinutes / 60).toFixed(1);
    res.json({ totalVideos, totalSeasons, totalHours: totalHours + "h" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST check password
app.post("/api/check-password", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  
  if (password === adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Wrong password" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ============ Start Server ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API: https://drdoaa-website.pxxl.click/api`);
  console.log(`🔐 Admin: https://drdoaa-website.pxxl.click/admin.html`);
  console.log(`🌍 CORS enabled for: https://drdoaa-website.pxxl.click`);
});
