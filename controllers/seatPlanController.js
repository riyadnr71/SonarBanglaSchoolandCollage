
const { getDB } = require("../config/db");

/* =========================================================
   GET SEAT PLAN BY CLASS
   Branch filter removed
========================================================= */

const getSeatPlan = async (req, res) => {
  try {
    const db = getDB();

    const { className } = req.query;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!className?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Class is required",
      });
    }

    const selectedClass = className.trim();

    /* =====================================================
       GET ACTIVE STUDENTS BY CLASS
       Branch is not required
    ===================================================== */

    const students = await db
      .collection("students")
      .find({
        className: selectedClass,
        status: "Active",
      })
      .toArray();

    /* =====================================================
       SORT BY ROLL
    ===================================================== */

    students.sort((a, b) => {
      const rollA = Number(a.roll);
      const rollB = Number(b.roll);

      const validRollA =
        a.roll !== undefined &&
        a.roll !== null &&
        String(a.roll).trim() !== "" &&
        Number.isFinite(rollA);

      const validRollB =
        b.roll !== undefined &&
        b.roll !== null &&
        String(b.roll).trim() !== "" &&
        Number.isFinite(rollB);

      if (validRollA && validRollB) {
        return rollA - rollB;
      }

      return String(a.roll || "").localeCompare(
        String(b.roll || ""),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        }
      );
    });

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,
      className: selectedClass,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Get Seat Plan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate seat plan",
      error: error.message,
    });
  }
};

module.exports = {
  getSeatPlan,
};
