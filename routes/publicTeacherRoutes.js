
const express = require("express");
const { getDB } = require("../config/db");

const router = express.Router();

// GET /api/public-teachers
// Public API: only safe fields for the school website
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const teachers = await db
      .collection("teachers")
      .aggregate([
        {
          $match: {
            $expr: {
              $eq: [
                { $toLower: { $ifNull: ["$status", ""] } },
                "active",
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            image: 1,
            designation: 1,
            qualification: 1,
            subject: 1,
            mobile: 1
          },
        },
        {
          $sort: {
            name: 1,
          },
        },
      ])
      .toArray();

    return res.status(200).json({
      success: true,
      count: teachers.length,
      teachers,
    });
  } catch (error) {
    console.error("Public teacher list error:", error);

    return res.status(500).json({
      success: false,
      message: "শিক্ষকদের তালিকা লোড করা যায়নি।",
    });
  }
});

module.exports = router;
