const { getDB } = require("../config/db");

/* =========================================================
GET SEAT PLAN BY CLASS + BRANCH
========================================================= */

const getSeatPlan = async (req, res) => {
try {
const db = getDB();


const {
  className,
  branch,
} = req.query;

/* =====================================================
   VALIDATION
===================================================== */

if (!className?.trim()) {
  return res.status(400).json({
    success: false,
    message: "Class is required",
  });
}

if (!branch?.trim()) {
  return res.status(400).json({
    success: false,
    message: "Branch is required",
  });
}

/* =====================================================
   CLEAN VALUES
===================================================== */

const selectedClass =
  className.trim();

const selectedBranch =
  branch.trim();

/* =====================================================
   GET ACTIVE STUDENTS
   
   Branch + Class দুটোই match করবে
===================================================== */

const students =
  await db
    .collection("students")
    .find({
      className: selectedClass,
      branch: selectedBranch,
      status: "Active",
    })
    .toArray();

/* =====================================================
   SORT BY ROLL
===================================================== */

students.sort((a, b) => {
  const rollA =
    parseInt(a.roll, 10);

  const rollB =
    parseInt(b.roll, 10);

  /* -----------------------------------------------
     দুই roll-ই number হলে numeric sort
  ------------------------------------------------ */

  if (
    !isNaN(rollA) &&
    !isNaN(rollB)
  ) {
    return rollA - rollB;
  }

  /* -----------------------------------------------
     অন্যথায় natural string sort
  ------------------------------------------------ */

  return String(
    a.roll || ""
  ).localeCompare(
    String(
      b.roll || ""
    ),
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

  branch:
    selectedBranch,

  className:
    selectedClass,

  count:
    students.length,

  students,
});


} catch (error) {
/* =====================================================
ERROR
===================================================== */


console.error(
  "Get Seat Plan Error:",
  error
);

return res.status(500).json({
  success: false,

  message:
    "Failed to generate seat plan",

  error:
    error.message,
});


}
};

/* =========================================================
EXPORT
========================================================= */

module.exports = {
getSeatPlan,
};
