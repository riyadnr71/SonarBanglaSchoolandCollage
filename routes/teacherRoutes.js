
const express = require("express");

const {
  addTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  regenerateTeacherQr,
  generateMissingTeacherQr,
} = require("../controllers/teacherController");

const authMiddleware = require("../middleware/authMiddleware");
const teacherUpload = require("../middleware/teacherUpload");

const router = express.Router();

/* =========================================================
   GET ALL TEACHERS
========================================================= */

router.get(
  "/",
  authMiddleware,
  getTeachers
);

/* =========================================================
   GET SINGLE TEACHER
========================================================= */

router.get(
  "/:id",
  authMiddleware,
  getTeacherById
);

/* =========================================================
   ADD TEACHER
   FormData + Image
========================================================= */

router.post(
  "/",
  authMiddleware,
  teacherUpload.single("image"),
  addTeacher
);

/* =========================================================
   UPDATE TEACHER
   FormData + Image
========================================================= */

router.put(
  "/:id",
  authMiddleware,
  teacherUpload.single("image"),
  updateTeacher
);

/* =========================================================
   REGENERATE QR
========================================================= */

router.put(
  "/:id/regenerate-qr",
  authMiddleware,
  regenerateTeacherQr
);

/* =========================================================
   GENERATE MISSING QR
========================================================= */

router.put(
  "/:id/generate-qr",
  authMiddleware,
  generateMissingTeacherQr
);

/* =========================================================
   DELETE TEACHER
========================================================= */

router.delete(
  "/:id",
  authMiddleware,
  deleteTeacher
);

module.exports = router;

