const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============ CORS Configuration ============
const corsOptions = {
  origin: ['https://drdoaa-website.pxxl.click', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
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
console.log('🔄 Attempting to connect to MongoDB Atlas...');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
})
.then(() => console.log("✅ Connected to MongoDB Atlas successfully"))
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  console.error("Please check your MONGODB_URI and network access");
});

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected');
});

// ============ Schemas ============
const videoSchema = new mongoose.Schema({
  seasonId: Number,
  number: Number,
  title: String,
  youtubeId: String,
  duration: String,
  description: String,
}, { timestamps: true });

const Video = mongoose.model("Video", videoSchema);

const seasonSchema = new mongoose.Schema({
  seasonId: { type: Number, unique: true },
  title: String,
  subtitle: String,
  badge: String,
}, { timestamps: true });

const Season = mongoose.model("Season", seasonSchema);

// ============ API Routes ============

// GET all seasons
app.get("/api/seasons", async (req, res) => {
  try {
    console.log('📡 Fetching all seasons...');
    const seasons = await Season.find().sort({ seasonId: 1 });
    console.log(`✅ Found ${seasons.length} seasons`);
    res.json(seasons);
  } catch (error) {
    console.error('❌ Error fetching seasons:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET specific season
app.get("/api/seasons/:seasonId", async (req, res) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    console.log(`📡 Fetching season ${seasonId}...`);
    
    const season = await Season.findOne({ seasonId });
    if (!season) {
      return res.status(404).json({ error: "Season not found" });
    }
    
    console.log(`✅ Found season ${seasonId}`);
    res.json(season);
  } catch (error) {
    console.error('❌ Error fetching season:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET videos by season
app.get("/api/seasons/:seasonId/videos", async (req, res) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    console.log(`📡 Fetching videos for season ${seasonId}...`);
    
    const videos = await Video.find({ seasonId }).sort({ number: 1 });
    console.log(`✅ Found ${videos.length} videos for season ${seasonId}`);
    
    res.json(videos);
  } catch (error) {
    console.error('❌ Error fetching videos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST new video
app.post("/api/videos", async (req, res) => {
  try {
    console.log('📡 Creating new video...');
    
    const video = new Video(req.body);
    await video.save();
    
    console.log(`✅ Video created successfully: ${video.title}`);
    res.status(201).json(video);
  } catch (error) {
    console.error('❌ Error creating video:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// PUT update video
app.put("/api/videos/:id", async (req, res) => {
  try {
    const videoId = req.params.id;
    console.log(`📡 Updating video ${videoId}...`);
    
    const video = await Video.findByIdAndUpdate(
      videoId, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    console.log(`✅ Video updated successfully: ${video.title}`);
    res.json(video);
  } catch (error) {
    console.error('❌ Error updating video:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// DELETE video
app.delete("/api/videos/:id", async (req, res) => {
  try {
    const videoId = req.params.id;
    console.log(`📡 Deleting video ${videoId}...`);
    
    const video = await Video.findByIdAndDelete(videoId);
    
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    console.log(`✅ Video deleted successfully: ${video.title}`);
    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    console.error('❌ Error deleting video:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET stats
app.get("/api/stats", async (req, res) => {
  try {
    console.log('📡 Fetching stats...');
    
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
    
    console.log(`✅ Stats: ${totalVideos} videos, ${totalSeasons} seasons, ${totalHours}h total`);
    
    res.json({ 
      totalVideos, 
      totalSeasons, 
      totalHours: totalHours + "h" 
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST check password
app.post("/api/check-password", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  
  console.log('📡 Password check attempt');
  
  if (password === adminPassword) {
    console.log('✅ Password correct');
    res.json({ success: true });
  } else {
    console.log('❌ Password incorrect');
    res.status(401).json({ success: false, error: "Wrong password" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// ============ 404 handler ============
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ============ Error handler ============
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: "Internal server error" });
});

// ============ Start Server ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`🌍 CORS enabled for: https://drdoaa-website.pxxl.click`);
});
