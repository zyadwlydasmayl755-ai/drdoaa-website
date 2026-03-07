const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CORS Configuration ============
const corsOptions = {
  origin: [
    'https://drdoaa-website.pxxl.click',
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

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

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
  seasonId: { type: Number, required: true },
  number: { type: Number, required: true },
  title: { type: String, required: true },
  youtubeId: { type: String, required: true },
  duration: { type: String, required: true },
  description: { type: String, default: '' },
}, { 
  timestamps: true 
});

const seasonSchema = new mongoose.Schema({
  seasonId: { type: Number, unique: true, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  badge: { type: String, default: '' },
}, { 
  timestamps: true 
});

const Video = mongoose.model("Video", videoSchema);
const Season = mongoose.model("Season", seasonSchema);

// ============ API Routes - Seasons ============

// GET all seasons
app.get("/api/seasons", async (req, res) => {
  try {
    const seasons = await Season.find().sort({ seasonId: 1 });
    res.json(seasons);
  } catch (error) {
    console.error('❌ Error fetching seasons:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET specific season
app.get("/api/seasons/:seasonId", async (req, res) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    const season = await Season.findOne({ seasonId });
    
    if (!season) {
      return res.status(404).json({ error: "Season not found" });
    }
    
    res.json(season);
  } catch (error) {
    console.error('❌ Error fetching season:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST new season
app.post("/api/seasons", async (req, res) => {
  try {
    const { title, subtitle, badge } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: "Season title is required" });
    }
    
    // Get the highest seasonId
    const lastSeason = await Season.findOne().sort({ seasonId: -1 });
    const newSeasonId = lastSeason ? lastSeason.seasonId + 1 : 4;
    
    const newSeason = new Season({
      seasonId: newSeasonId,
      title: title,
      subtitle: subtitle || `Season ${newSeasonId}`,
      badge: badge || `Season ${newSeasonId}`
    });
    
    await newSeason.save();
    console.log(`✅ Season created: ${newSeason.title} (ID: ${newSeason.seasonId})`);
    res.status(201).json(newSeason);
  } catch (error) {
    console.error('❌ Error creating season:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT update season
app.put("/api/seasons/:seasonId", async (req, res) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    const season = await Season.findOne({ seasonId });
    
    if (!season) {
      return res.status(404).json({ error: "Season not found" });
    }
    
    // Update fields
    if (req.body.title) season.title = req.body.title;
    if (req.body.subtitle !== undefined) season.subtitle = req.body.subtitle;
    if (req.body.badge !== undefined) season.badge = req.body.badge;
    
    await season.save();
    console.log(`✅ Season updated: ${season.title} (ID: ${season.seasonId})`);
    res.json(season);
  } catch (error) {
    console.error('❌ Error updating season:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE season
app.delete("/api/seasons/:seasonId", async (req, res) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    
    // Prevent deletion of default seasons (1,2,3)
    if (seasonId <= 3) {
      return res.status(403).json({ error: "Cannot delete default seasons (1, 2, 3)" });
    }
    
    // Check if season has videos
    const videosCount = await Video.countDocuments({ seasonId });
    if (videosCount > 0) {
      return res.status(400).json({ 
        error: "Cannot delete season with videos. Delete all videos in this season first." 
      });
    }
    
    const result = await Season.deleteOne({ seasonId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Season not found" });
    }
    
    console.log(`✅ Season deleted: ID ${seasonId}`);
    res.json({ message: "Season deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting season:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ API Routes - Videos ============

// GET videos by season
app.get("/api/seasons/:seasonId/videos", async (req, res) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    const videos = await Video.find({ seasonId }).sort({ number: 1 });
    res.json(videos);
  } catch (error) {
    console.error('❌ Error fetching videos:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST new video
app.post("/api/videos", async (req, res) => {
  try {
    const { seasonId, number, title, youtubeId, duration, description } = req.body;
    
    // Validate required fields
    if (!seasonId || !number || !title || !youtubeId || !duration) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Check if video number already exists in this season
    const existingVideo = await Video.findOne({ seasonId, number });
    if (existingVideo) {
      return res.status(400).json({ 
        error: `Video number ${number} already exists in season ${seasonId}` 
      });
    }
    
    const video = new Video({
      seasonId,
      number,
      title,
      youtubeId,
      duration,
      description: description || ''
    });
    
    await video.save();
    console.log(`✅ Video created: ${video.title} (Season ${seasonId}, #${number})`);
    res.status(201).json(video);
  } catch (error) {
    console.error('❌ Error creating video:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT update video
app.put("/api/videos/:id", async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    // Update fields
    if (req.body.number) video.number = req.body.number;
    if (req.body.title) video.title = req.body.title;
    if (req.body.youtubeId) video.youtubeId = req.body.youtubeId;
    if (req.body.duration) video.duration = req.body.duration;
    if (req.body.description !== undefined) video.description = req.body.description;
    
    await video.save();
    console.log(`✅ Video updated: ${video.title}`);
    res.json(video);
  } catch (error) {
    console.error('❌ Error updating video:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE video
app.delete("/api/videos/:id", async (req, res) => {
  try {
    const video = await Video.findByIdAndDelete(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    console.log(`✅ Video deleted: ${video.title}`);
    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting video:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ API Routes - Stats ============

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
    
    res.json({ 
      totalVideos, 
      totalSeasons, 
      totalHours: totalHours + "h" 
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ Authentication ============

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

// ============ Health Check ============

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime()
  });
});

// ============ 404 Handler ============

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ============ Error Handler ============

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: "Internal server error" });
});

// ============ Start Server ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API base URL: /api`);
  console.log(`🔐 Admin: /admin.html`);
  console.log(`🌍 CORS enabled for: ${corsOptions.origin.join(', ')}`);
});
