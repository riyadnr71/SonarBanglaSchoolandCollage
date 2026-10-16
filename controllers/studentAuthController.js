const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");

/* =========================================================
   STUDENT LOGIN
   
========================================================= */

const studentLogin = async (req, res) => {
  try {
    const { studentId, password } = req.body;

    if (!studentId || !password) {
      return res.status(400).json({
        success: false,
        message: "Student ID and password are required.",
      });
    }

    const db = getDB();

    const student = await db.collection("students").findOne({
      idCard: String(studentId).trim(),
    });

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Invalid Student ID or password.",
      });
    }

    if (!student.passwordHash) {
      return res.status(401).json({
        success: false,
        message:
          "Student password is not configured. Please contact the administration.",
      });
    }

    const passwordMatched = await bcrypt.compare(
      String(password),
      student.passwordHash
    );

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid Student ID or password.",
      });
    }

    if (
      student.status &&
      String(student.status).toLowerCase() !== "active"
    ) {
      return res.status(403).json({
        success: false,
        message: "This student account is currently inactive.",
      });
    }

    const JWT_SECRET =
      process.env.JWT_SECRET ||
      process.env.JWT_SECRET_KEY;

    if (!JWT_SECRET) {
      console.error("JWT_SECRET is missing from .env");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error.",
      });
    }

    const token = jwt.sign(
      {
        studentId: student._id.toString(),
        type: "student",
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const { passwordHash, ...studentData } = student;

    return res.status(200).json({
      success: true,
      message: "Student login successful.",
      token,
      student: {
        ...studentData,
        _id: student._id,
      },
    });
  } catch (error) {
    console.error("Student Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Student login failed.",
    });
  }
};


const getStudentAttendance = async (req, res) => {
try {
const db = getDB();


const studentMongoId = req.student?.studentId;

if (
  !studentMongoId ||
  !ObjectId.isValid(studentMongoId)
) {
  return res.status(401).json({
    success: false,
    message: "Student authentication is invalid.",
  });
}

const student = await db
  .collection("students")
  .findOne({
    _id: new ObjectId(studentMongoId),
  });

if (!student) {
  return res.status(404).json({
    success: false,
    message: "Student not found.",
  });
}

/* =====================================================
   GET TODAY DATE — ASIA/DHAKA
===================================================== */

const getTodayDate = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

/* =====================================================
   GET ATTENDANCE SETTINGS
===================================================== */

const settings =
  await db
    .collection("attendanceSettings")
    .findOne({});

const attendanceStartTime =
  settings?.attendanceStartTime || "08:00";

const absentAfterTime =
  settings?.absentAfterTime || "09:00";

/* =====================================================
   CURRENT DATE
===================================================== */

const today = getTodayDate();

/* =====================================================
   GET ALL ATTENDANCE RECORDS
===================================================== */

const attendance =
  await db
    .collection("attendance")
    .find({
      studentId: student._id,
      date: {
        $lte: today,
      },
    })
    .sort({
      date: -1,
    })
    .toArray();

/* =====================================================
   GENERATE DATE RANGE

   এখানে শিক্ষার্থী ভর্তি হওয়ার তারিখ থেকে
   আজ পর্যন্ত হিসাব করা হবে।
===================================================== */

const startDateValue =
  student.admissionDate ||
  student.createdAt ||
  today;

const startDate = new Date(
  `${String(startDateValue).slice(0, 10)}T00:00:00`
);

const endDate = new Date(
  `${today}T00:00:00`
);

const dateList = [];

if (
  !Number.isNaN(startDate.getTime()) &&
  !Number.isNaN(endDate.getTime())
) {
  const current = new Date(startDate);

  while (current <= endDate) {
    const year =
      current.getFullYear();

    const month =
      String(
        current.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        current.getDate()
      ).padStart(2, "0");

    dateList.push(
      `${year}-${month}-${day}`
    );

    current.setDate(
      current.getDate() + 1
    );
  }
}

/* =====================================================
   ATTENDANCE MAP
===================================================== */

const attendanceMap =
  new Map();

attendance.forEach((record) => {
  attendanceMap.set(
    String(record.date),
    record
  );
});

/* =====================================================
   BUILD DATE-WISE ATTENDANCE

   Database-এ record না থাকলে:
   → Absent

   তবে আজকের দিন যদি এখনও
   attendanceStartTime-এর আগে হয়,
   তখন Absent দেখানো হবে না।
===================================================== */

const todayTime = new Intl.DateTimeFormat(
  "en-GB",
  {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }
).format(new Date());

const todayMinutes =
  Number(todayTime.split(":")[0]) * 60 +
  Number(todayTime.split(":")[1]);

const absentAfterMinutes =
  Number(
    String(absentAfterTime).split(":")[0]
  ) *
    60 +
  Number(
    String(absentAfterTime).split(":")[1]
  );

const generatedAttendance =
  dateList.map((date) => {
    const existing =
      attendanceMap.get(date);

    /* -----------------------------------------------
       EXISTING RECORD
    ------------------------------------------------ */

    if (existing) {
      return existing;
    }

    /* -----------------------------------------------
       TODAY BEFORE ABSENT CUTOFF

       এখনো Absent হওয়ার সময় হয়নি।
    ------------------------------------------------ */

    if (
      date === today &&
      todayMinutes <
        absentAfterMinutes
    ) {
      return {
        _id: `virtual-${date}`,
        studentId: student._id,
        studentIdCard:
          student.idCard || "",
        studentName:
          student.name || "",
        branch:
          student.branch ||
          "Main Branch",
        className:
          student.className || "",
        section:
          student.section || "",
        date,
        entryTime: null,
        exitTime: null,
        status: "Pending",
        leaveReason: "",
        virtual: true,
      };
    }

    /* -----------------------------------------------
       NO RECORD = ABSENT
    ------------------------------------------------ */

    return {
      _id: `virtual-${date}`,
      studentId: student._id,
      studentIdCard:
        student.idCard || "",
      studentName:
        student.name || "",
      branch:
        student.branch ||
        "Main Branch",
      className:
        student.className || "",
      section:
        student.section || "",
      date,
      entryTime: null,
      exitTime: null,
      status: "Absent",
      leaveReason: "",
      virtual: true,
    };
  });

/* =====================================================
   REMOVE FUTURE / PENDING IF NEEDED
===================================================== */

const finalAttendance =
  generatedAttendance
    .filter((item) => {
      if (
        item.status === "Pending"
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      String(b.date).localeCompare(
        String(a.date)
      )
    );

/* =====================================================
   SUMMARY
===================================================== */

const summary = {
  total: finalAttendance.length,

  present:
    finalAttendance.filter(
      (item) =>
        item.status ===
        "Present"
    ).length,

  late:
    finalAttendance.filter(
      (item) =>
        item.status ===
        "Late"
    ).length,

  leave:
    finalAttendance.filter(
      (item) =>
        item.status ===
        "Leave"
    ).length,

  absent:
    finalAttendance.filter(
      (item) =>
        item.status ===
        "Absent"
    ).length,
};

const attendanceDays =
  summary.present +
  summary.late +
  summary.leave +
  summary.absent;

const attendedDays =
  summary.present +
  summary.late;

summary.percentage =
  attendanceDays > 0
    ? Math.round(
        (attendedDays /
          attendanceDays) *
          100
      )
    : 0;

return res.status(200).json({
  success: true,

  student: {
    _id: student._id,
    name: student.name,
    idCard: student.idCard,
    roll: student.roll,
    branch:
      student.branch ||
      "Main Branch",
    className:
      student.className,
    section:
      student.section,
  },

  settings: {
    attendanceStartTime,
    absentAfterTime,
    lateAllowed:
      settings?.lateAllowed !== false,
  },

  summary,

  attendance: finalAttendance,
});


} catch (error) {
console.error(
"Get Student Attendance Error:",
error
);


return res.status(500).json({
  success: false,
  message:
    "Failed to load student attendance.",
});


}
};


/* =========================================================
   GET CURRENT STUDENT
========================================================= */

const getStudentMe = async (req, res) => {
  try {
    const db = getDB();

    const studentId = req.student?.studentId;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Student authentication required.",
      });
    }

    if (!ObjectId.isValid(studentId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid student authentication.",
      });
    }

    const student = await db.collection("students").findOne({
      _id: new ObjectId(studentId),
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const { passwordHash, ...studentData } = student;

    return res.status(200).json({
      success: true,
      student: {
        ...studentData,
        _id: student._id,
      },
    });
  } catch (error) {
    console.error("Get Student Me Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load student profile.",
    });
  }
};

/* =========================================================
   GET LOGGED-IN STUDENT FEES
========================================================= */

const getStudentFees = async (req, res) => {
  try {
    const db = getDB();

    const studentMongoId = req.student?.studentId;

    if (!studentMongoId) {
      return res.status(401).json({
        success: false,
        message: "Student authentication required.",
      });
    }

    if (!ObjectId.isValid(studentMongoId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid student authentication.",
      });
    }

    const student = await db.collection("students").findOne({
      _id: new ObjectId(studentMongoId),
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    /*
      New fee records normally use:
      studentId = MongoDB _id string

      Legacy records may use:
      ObjectId
      or idCard

      So support all common formats.
    */

    const possibleStudentIds = [
      student._id.toString(),
      student.idCard ? String(student.idCard) : null,
    ].filter(Boolean);

    const feeQuery = {
      $or: [
        {
          studentId: {
            $in: possibleStudentIds,
          },
        },
        {
          studentId: student._id,
        },
      ],
    };

    const fees = await db
      .collection("fees")
      .find(feeQuery)
      .sort({
        year: -1,
        createdAt: -1,
      })
      .toArray();

    const normalizedFees = fees.map((fee) => {
      let payments = [];

      if (Array.isArray(fee.payments)) {
        payments = fee.payments;
      } else if (Number(fee.paidAmount) > 0) {
        payments = [
          {
            amount: Number(fee.paidAmount) || 0,
            date:
              fee.paymentDate ||
              fee.createdAt ||
              "",
            invoiceNumber:
              fee.invoiceNumber ||
              "LEGACY",
          },
        ];
      }

      const total =
        Number(fee.total) ||
        Number(fee.monthlyFee || 0) +
          Number(fee.examFee || 0);

      const paidAmount =
        Number(fee.paidAmount) ||
        payments.reduce(
          (sum, payment) =>
            sum +
            Number(payment?.amount || 0),
          0
        );

      const dueAmount = Math.max(
        0,
        total - paidAmount
      );

      let paymentStatus = "Due";

      if (dueAmount <= 0 && total > 0) {
        paymentStatus = "Paid";
      } else if (paidAmount > 0) {
        paymentStatus = "Partial";
      }

      return {
        ...fee,

        total,

        paidAmount,

        dueAmount,

        paymentStatus,

        payments,
      };
    });

    return res.status(200).json({
      success: true,
      fees: normalizedFees,
    });
  } catch (error) {
    console.error("Get Student Fees Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load student fees.",
    });
  }
};

/* =========================================================
   GET LOGGED-IN STUDENT RESULTS
========================================================= */

const getStudentResults = async (req, res) => {
  try {
    const db = getDB();

    const studentMongoId = req.student?.studentId;

    if (!studentMongoId) {
      return res.status(401).json({
        success: false,
        message: "Student authentication required.",
      });
    }

    if (!ObjectId.isValid(studentMongoId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid student authentication.",
      });
    }

    const student = await db.collection("students").findOne({
      _id: new ObjectId(studentMongoId),
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    /*
      Results normally store:

      studentId: ObjectId

      But older data may have stored
      studentId as string.

      Support both.
    */

    const results = await db
      .collection("results")
      .find({
        $or: [
          {
            studentId: student._id,
          },
          {
            studentId: student._id.toString(),
          },
        ],
      })
      .sort({
        year: -1,
        createdAt: -1,
      })
      .toArray();

    /*
      Attach latest student photo if result
      does not already have one.
    */

    const resultsWithStudentInfo =
      results.map((result) => ({
        ...result,

        studentName:
          result.studentName ||
          student.name ||
          "",

        studentIdCard:
          result.studentIdCard ||
          student.idCard ||
          "",

        roll:
          result.roll ||
          student.roll ||
          "",

        className:
          result.className ||
          student.className ||
          "",

        session:
          result.session ||
          student.session ||
          "",

        studentPhoto:
          result.studentPhoto ||
          student.image ||
          "",
      }));

    return res.status(200).json({
      success: true,

      results: resultsWithStudentInfo,
    });
  } catch (error) {
    console.error(
      "Get Student Results Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load student results.",
    });
  }
};

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  studentLogin,
  getStudentMe,
  getStudentFees,
  getStudentResults,
  getStudentAttendance,
};