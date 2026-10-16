const express = require("express");

const router = express.Router();

const {
studentLogin,
getStudentMe,
getStudentFees,
getStudentResults,
getStudentAttendance,
} = require("../controllers/studentAuthController");

const studentAuthMiddleware = require("../middleware/studentAuthMiddleware");

/* =========================================================
STUDENT LOGIN
========================================================= */

router.post("/login", studentLogin);

/* =========================================================
STUDENT ATTENDANCE
IMPORTANT:
This route must come before /:id routes.
========================================================= */

router.get(
"/attendance",
studentAuthMiddleware,
getStudentAttendance
);

/* =========================================================
STUDENT PROFILE
========================================================= */

router.get(
"/me",
studentAuthMiddleware,
getStudentMe
);

/* =========================================================
STUDENT FEES
========================================================= */

router.get(
"/:id/fees",
studentAuthMiddleware,
getStudentFees
);

/* =========================================================
STUDENT RESULTS
========================================================= */

router.get(
"/:id/results",
studentAuthMiddleware,
getStudentResults
);

module.exports = router;
