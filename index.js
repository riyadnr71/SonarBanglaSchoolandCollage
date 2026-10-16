
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDB } = require("./config/db");

// =========================================================
// ROUTES
// =========================================================

// AUTH
const authRoutes = require("./routes/authRoutes");

// STUDENTS
const studentRoutes = require("./routes/studentRoutes");

// STUDENT AUTH
const studentAuthRoutes = require("./routes/studentAuthRoutes");

// SUBJECTS
const subjectRoutes = require("./routes/subjectRoutes");

// RESULTS
const resultRoutes = require("./routes/resultRoutes");
const publicResultRoutes = require("./routes/publicResultRoutes");

// PUBLIC IMAGE
const publicImageRoutes = require("./routes/publicImageRoutes");

// FEES
const feeRoutes = require("./routes/feeRoutes");
const feeSetupRoutes = require("./routes/feeSetupRoutes");

// TEACHERS
const teacherRoutes = require("./routes/teacherRoutes");

// TEACHER ATTENDANCE
const teacherAttendanceRoutes = require("./routes/teacherAttendanceRoutes");
// teacher Public routes
const publicTeacherRoutes = require("./routes/publicTeacherRoutes");
// EXPENSES
const expenseRoutes = require("./routes/expenseRoutes");

// NOTICES
const noticeRoutes = require("./routes/noticeRoutes");
const publicNoticeRoutes = require("./routes/publicNoticeRoutes");

// DASHBOARD
const dashboardRoutes = require("./routes/dashboardRoutes");

// REPORTS
const reportRoutes = require("./routes/reportRoutes");

// SEAT PLAN
const seatPlanRoutes = require("./routes/seatPlanRoutes");

// ATTENDANCE
const attendanceRoutes = require("./routes/attendanceRoutes");

// ATTENDANCE SETTINGS
const attendanceSettingsRoutes = require("./routes/attendanceSettingsRoutes");

// =========================================================
// APP
// =========================================================

const app = express();

// =========================================================
// ROUTE TYPE CHECK
// =========================================================

console.log(
  "ATTENDANCE SETTINGS:",
  typeof attendanceSettingsRoutes
);

console.log(
  "TEACHER ATTENDANCE:",
  typeof teacherAttendanceRoutes
);

console.log("========================================");
console.log("");

// =========================================================
// CORS
// =========================================================

app.use(
  cors({
    origin: [
      
      "http://localhost:5173",
      "http://localhost:5174",
      "https://schoolwebsite71.netlify.app",
      "https://school91.netlify.app",
      "https://sonarbanglaschoolandcollage.netlify.app"
    ],
    credentials: true,
  })
);

// =========================================================
// BODY PARSER
// =========================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);


// Teacher Public Routes
app.use("/api/public-teachers", publicTeacherRoutes);

// =========================================================
// HEALTH CHECK
// =========================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Madrasa Management API চলছে ✓",
  });
});

// =========================================================
// ROUTE MOUNTING DEBUG
// =========================================================

console.log("========================================");
console.log("🚀 STARTING ROUTE MOUNTING");
console.log("========================================");

// =========================================================
// ADMIN AUTH
// =========================================================

console.log("1️⃣ Mounting AUTH...");

app.use(
  "/api/auth",
  authRoutes
);

console.log("✅ AUTH mounted successfully");

// =========================================================
// DASHBOARD
// =========================================================

console.log("2️⃣ Mounting DASHBOARD...");

app.use(
  "/api/dashboard",
  dashboardRoutes
);

console.log("✅ DASHBOARD mounted successfully");

// =========================================================
// STUDENT AUTH
// =========================================================

console.log("3️⃣ Mounting STUDENT AUTH...");

app.use(
  "/api/student-auth",
  studentAuthRoutes
);

console.log("✅ STUDENT AUTH mounted successfully");

// =========================================================
// REPORTS
// =========================================================

console.log("4️⃣ Mounting REPORTS...");

app.use(
  "/api/reports",
  reportRoutes
);

console.log("✅ REPORTS mounted successfully");

// =========================================================
// STUDENTS
// =========================================================

console.log("5️⃣ Mounting STUDENTS...");

app.use(
  "/api/students",
  studentRoutes
);

console.log("✅ STUDENTS mounted successfully");

// =========================================================
// SUBJECTS
// =========================================================

console.log("6️⃣ Mounting SUBJECTS...");

app.use(
  "/api/subjects",
  subjectRoutes
);

console.log("✅ SUBJECTS mounted successfully");

// =========================================================
// RESULTS
// =========================================================

console.log("7️⃣ Mounting RESULTS...");

app.use(
  "/api/results",
  resultRoutes
);

console.log("✅ RESULTS mounted successfully");

// =========================================================
// PUBLIC RESULT
// =========================================================

console.log("8️⃣ Mounting PUBLIC RESULT...");

app.use(
  "/api/public-result",
  publicResultRoutes
);

console.log("✅ PUBLIC RESULT mounted successfully");

// =========================================================
// PUBLIC IMAGE
// =========================================================

console.log("9️⃣ Mounting PUBLIC IMAGE...");

app.use(
  "/api/public-image",
  publicImageRoutes
);

console.log("✅ PUBLIC IMAGE mounted successfully");

// =========================================================
// FEES
// =========================================================

console.log("🔟 Mounting FEES...");

app.use(
  "/api/fees",
  feeRoutes
);

console.log("✅ FEES mounted successfully");

// =========================================================
// FEE SETUP
// =========================================================

console.log("1️⃣1️⃣ Mounting FEE SETUP...");

app.use(
  "/api/fee-setups",
  feeSetupRoutes
);

console.log("✅ FEE SETUP mounted successfully");

// =========================================================
// TEACHERS
// =========================================================

console.log("1️⃣2️⃣ Mounting TEACHERS...");

app.use(
  "/api/teachers",
  teacherRoutes
);

console.log("✅ TEACHERS mounted successfully");

// =========================================================
// TEACHER ATTENDANCE
// =========================================================

console.log("1️⃣3️⃣ Mounting TEACHER ATTENDANCE...");

app.use(
  "/api/teacher-attendance",
  teacherAttendanceRoutes
);

console.log(
  "✅ TEACHER ATTENDANCE mounted successfully"
);

// =========================================================
// EXPENSES
// =========================================================

console.log("1️⃣4️⃣ Mounting EXPENSES...");

app.use(
  "/api/expenses",
  expenseRoutes
);

console.log("✅ EXPENSES mounted successfully");

// =========================================================
// NOTICES
// =========================================================

console.log("1️⃣5️⃣ Mounting NOTICES...");

app.use(
  "/api/notices",
  noticeRoutes
);

console.log("✅ NOTICES mounted successfully");

// =========================================================
// PUBLIC NOTICES
// =========================================================

console.log("1️⃣6️⃣ Mounting PUBLIC NOTICES...");

app.use(
  "/api/public-notices",
  publicNoticeRoutes
);

console.log("✅ PUBLIC NOTICES mounted successfully");

// =========================================================
// SEAT PLAN
// =========================================================

console.log("1️⃣7️⃣ Mounting SEAT PLAN...");

app.use(
  "/api/seat-plan",
  seatPlanRoutes
);

console.log("✅ SEAT PLAN mounted successfully");

// =========================================================
// STUDENT ATTENDANCE
// =========================================================

console.log("1️⃣8️⃣ Mounting STUDENT ATTENDANCE...");

app.use(
  "/api/attendance",
  attendanceRoutes
);

console.log("✅ STUDENT ATTENDANCE mounted successfully");

// =========================================================
// ATTENDANCE SETTINGS
// =========================================================

console.log("1️⃣9️⃣ Mounting ATTENDANCE SETTINGS...");

app.use(
  "/api/attendance-settings",
  attendanceSettingsRoutes
);

console.log(
  "✅ ATTENDANCE SETTINGS mounted successfully"
);

// =========================================================
// ALL ROUTES MOUNTED
// =========================================================

console.log("========================================");
console.log("✅ ALL ROUTES MOUNTED");
console.log("========================================");
console.log("");

// =========================================================
// 404
// =========================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// =========================================================
// GLOBAL ERROR HANDLER
// =========================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Global Error:",
      error
    );

    // -----------------------------------------------------
    // MULTER - FILE SIZE
    // -----------------------------------------------------

    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Image size must be less than 5MB",
      });
    }

    // -----------------------------------------------------
    // MULTER - INVALID FILE TYPE
    // -----------------------------------------------------

    if (
      error.message ===
      "Only image files are allowed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only image files are allowed",
      });
    }

    // -----------------------------------------------------
    // DEFAULT ERROR
    // -----------------------------------------------------

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
      error:
        error.message,
    });
  }
);

// =========================================================
// SERVER
// =========================================================

const PORT =
  process.env.PORT || 5000;

// =========================================================
// START SERVER
// =========================================================

const startServer = async () => {
  try {
    // -----------------------------------------------------
    // CONNECT DATABASE
    // -----------------------------------------------------

    await connectDB();

    // -----------------------------------------------------
    // START EXPRESS SERVER
    // -----------------------------------------------------

    app.listen(
      PORT,
      () => {
        console.log("");

        console.log(
          "========================================"
        );

        console.log(
          "🚀 Madrasa Management Server Started"
        );

        console.log(
          "========================================"
        );

        console.log(
          `🚀 Server running on port ${PORT}`
        );

        console.log(
          `🌐 http://localhost:${PORT}`
        );

        // -------------------------------------------------
        // DASHBOARD
        // -------------------------------------------------

        console.log("");

        console.log(
          "📊 Dashboard:"
        );

        console.log(
          `   http://localhost:${PORT}/api/dashboard`
        );

        // -------------------------------------------------
        // REPORTS
        // -------------------------------------------------

        console.log("");

        console.log(
          "📑 Reports:"
        );

        console.log(
          `   Result:    http://localhost:${PORT}/api/reports/results`
        );

        console.log(
          `   Fee:       http://localhost:${PORT}/api/reports/fees`
        );

        console.log(
          `   Expense:   http://localhost:${PORT}/api/reports/expenses`
        );

        console.log(
          `   Financial: http://localhost:${PORT}/api/reports/financial`
        );

        // -------------------------------------------------
        // STUDENT AUTH
        // -------------------------------------------------

        console.log("");

        console.log(
          "🎓 Student Auth:"
        );

        console.log(
          `   Login: http://localhost:${PORT}/api/student-auth/login`
        );

        console.log(
          `   Me:    http://localhost:${PORT}/api/student-auth/me`
        );

        // -------------------------------------------------
        // TEACHERS
        // -------------------------------------------------

        console.log("");

        console.log(
          "👨‍🏫 Teachers:"
        );

        console.log(
          `   All:    http://localhost:${PORT}/api/teachers`
        );

        console.log(
          `   Single: http://localhost:${PORT}/api/teachers/:id`
        );

        console.log(
          `   Add:    http://localhost:${PORT}/api/teachers`
        );

        console.log(
          `   Update: http://localhost:${PORT}/api/teachers/:id`
        );

        console.log(
          `   Delete: http://localhost:${PORT}/api/teachers/:id`
        );

        console.log(
          `   Generate QR:    http://localhost:${PORT}/api/teachers/:id/generate-qr`
        );

        console.log(
          `   Regenerate QR:  http://localhost:${PORT}/api/teachers/:id/regenerate-qr`
        );

        // -------------------------------------------------
        // TEACHER ATTENDANCE
        // -------------------------------------------------

        console.log("");

        console.log(
          "📷 Teacher Attendance:"
        );

        console.log(
          `   Scan:    http://localhost:${PORT}/api/teacher-attendance/scan`
        );

        console.log(
          `   Today:   http://localhost:${PORT}/api/teacher-attendance/today`
        );

        console.log(
          `   History: http://localhost:${PORT}/api/teacher-attendance/history`
        );

        // -------------------------------------------------
        // PUBLIC RESULT
        // -------------------------------------------------

        console.log("");

        console.log(
          "📢 Public Result:"
        );

        console.log(
          `   http://localhost:${PORT}/api/public-result`
        );

        // -------------------------------------------------
        // PUBLIC NOTICES
        // -------------------------------------------------

        console.log("");

        console.log(
          "📢 Public Notices:"
        );

        console.log(
          `   http://localhost:${PORT}/api/public-notices`
        );

        // -------------------------------------------------
        // PUBLIC IMAGE
        // -------------------------------------------------

        console.log("");

        console.log(
          "🖼️ Public Image:"
        );

        console.log(
          `   http://localhost:${PORT}/api/public-image`
        );

        // -------------------------------------------------
        // STUDENT ATTENDANCE
        // -------------------------------------------------

        console.log("");

        console.log(
          "📚 Student Attendance:"
        );

        console.log(
          `   http://localhost:${PORT}/api/attendance`
        );

        // -------------------------------------------------
        // ATTENDANCE SETTINGS
        // -------------------------------------------------

        console.log("");

        console.log(
          "⚙️ Attendance Settings:"
        );

        console.log(
          `   http://localhost:${PORT}/api/attendance-settings`
        );

        // -------------------------------------------------
        // END
        // -------------------------------------------------

        console.log("");

        console.log(
          "========================================"
        );

        console.log(
          "✅ SERVER READY"
        );

        console.log(
          "========================================"
        );

        console.log("");
      }
    );
  } catch (error) {
    console.error(
      "❌ Server startup failed:",
      error.message
    );

    process.exit(1);
  }
};

// =========================================================
// RUN SERVER
// =========================================================

startServer();

