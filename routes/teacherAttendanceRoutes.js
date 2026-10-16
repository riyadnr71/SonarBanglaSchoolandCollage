const express = require("express");

const {
scanTeacherAttendance,
getTodayTeacherAttendance,
getTeacherAttendanceHistory,
} = require("../controllers/teacherAttendanceController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/*
Admin-only routes.
Teacher login is not required.
*/

router.post(
"/scan",
authMiddleware,
scanTeacherAttendance
);

router.get(
"/today",
authMiddleware,
getTodayTeacherAttendance
);

router.get(
"/history",
authMiddleware,
getTeacherAttendanceHistory
);

module.exports = router;
