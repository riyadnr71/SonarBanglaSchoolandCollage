
const express = require("express");

const {
  scanAttendance,
  getTodayAttendance,
  getStudentAttendance,
  getClassAttendance,
  markLeave,
  updateAttendance,
  deleteAttendance,
  getAttendanceReport,
} = require("../controllers/attendanceController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/* =========================================================
   ADMIN ATTENDANCE
========================================================= */

// Scan attendance
router.post(
  "/admin/scan",
  authMiddleware,
  scanAttendance
);

// Today's attendance
router.get(
  "/admin/today",
  authMiddleware,
  getTodayAttendance
);

// Student attendance
router.get(
  "/admin/student/:studentId",
  authMiddleware,
  getStudentAttendance
);

// Class attendance
router.get(
  "/admin/class/:className",
  authMiddleware,
  getClassAttendance
);

// Mark leave
router.post(
  "/admin/leave",
  authMiddleware,
  markLeave
);

// Update attendance
router.put(
  "/admin/:id",
  authMiddleware,
  updateAttendance
);

// Delete attendance
router.delete(
  "/admin/:id",
  authMiddleware,
  deleteAttendance
);

// Attendance report
router.get(
  "/admin/report",
  authMiddleware,
  getAttendanceReport
);

module.exports = router;

