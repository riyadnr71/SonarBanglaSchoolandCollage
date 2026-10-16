const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

/* =========================================================
BANGLADESH DATE / TIME
========================================================= */

const getTodayDate = () =>
new Intl.DateTimeFormat("en-CA", {
timeZone: "Asia/Dhaka",
year: "numeric",
month: "2-digit",
day: "2-digit",
}).format(new Date());

const getCurrentTime = () =>
new Intl.DateTimeFormat("en-GB", {
timeZone: "Asia/Dhaka",
hour: "2-digit",
minute: "2-digit",
second: "2-digit",
hour12: false,
}).format(new Date());

const timeToSeconds = (time) => {
const [hour = 0, minute = 0, second = 0] =
String(time || "00:00:00")
.split(":")
.map(Number);

return hour * 3600 + minute * 60 + second;
};

/* =========================================================
TEACHER RESPONSE
========================================================= */

const getTeacherResponse = (teacher) => ({
_id: teacher._id,
teacherId: teacher.teacherId,
name: teacher.name,
branch: teacher.branch || "Main Branch",
designation: teacher.designation || "",
subject: teacher.subject || "",
image: teacher.image || "",
});

/* =========================================================
SCAN TEACHER QR
First scan = Entry
Second scan after 2 minutes = Exit
========================================================= */

const scanTeacherAttendance = async (req, res) => {
try {
const db = getDB();


const scanValue = String(
  req.body?.scanValue || ""
).trim();

if (!scanValue) {
  return res.status(400).json({
    success: false,
    message: "Teacher QR code is required.",
  });
}

/*
  QR scanValue must match the teacher's
  randomly generated qrToken.
*/

const teacher = await db
  .collection("teachers")
  .findOne({
    qrToken: scanValue,
  });

if (!teacher) {
  return res.status(404).json({
    success: false,
    message: "Invalid teacher QR code.",
  });
}

if (
  String(teacher.status || "active").toLowerCase() !==
  "active"
) {
  return res.status(403).json({
    success: false,
    message: "This teacher is inactive.",
  });
}

const today = getTodayDate();
const currentTime = getCurrentTime();

const attendanceCollection =
  db.collection("teacherAttendance");

const teacherId = teacher._id;

const existing = await attendanceCollection.findOne({
  teacherId,
  date: today,
});

/* =====================================================
   ALREADY COMPLETED
===================================================== */

if (existing?.entryTime && existing?.exitTime) {
  return res.status(409).json({
    success: false,
    alreadyCompleted: true,
    action: "completed",
    message: "Today's entry and exit are already completed.",
    teacher: getTeacherResponse(teacher),
    attendance: existing,
  });
}

/* =====================================================
   FIRST SCAN = ENTRY
===================================================== */

if (!existing) {
  const settings = await db
    .collection("attendanceSettings")
    .findOne({});

  const startTime =
    settings?.attendanceStartTime || "08:00";

  const absentAfterTime =
    settings?.absentAfterTime || "09:00";

  const currentMinutes =
    timeToSeconds(currentTime) / 60;

  const startMinutes =
    timeToSeconds(startTime) / 60;

  const absentAfterMinutes =
    timeToSeconds(absentAfterTime) / 60;

  if (currentMinutes < startMinutes) {
    return res.status(400).json({
      success: false,
      message: `Attendance starts at ${startTime}.`,
      teacher: getTeacherResponse(teacher),
    });
  }

  let status = "Present";

  if (currentMinutes >= absentAfterMinutes) {
    if (settings?.lateAllowed === false) {
      return res.status(403).json({
        success: false,
        message: "Late attendance is not allowed.",
        teacher: getTeacherResponse(teacher),
      });
    }

    status = "Late";
  }

  const now = new Date();

  const attendanceData = {
    teacherId,
    teacherCode: teacher.teacherId || "",
    teacherName: teacher.name || "",
    branch: teacher.branch || "Main Branch",
    date: today,
    entryTime: currentTime,
    exitTime: null,
    status,
    createdAt: now,
    updatedAt: now,
  };

  const result = await attendanceCollection.insertOne(
    attendanceData
  );

  return res.status(201).json({
    success: true,
    action: "entry",
    message:
      status === "Late"
        ? "Teacher late entry recorded."
        : "Teacher entry recorded successfully.",
    teacher: getTeacherResponse(teacher),
    attendance: {
      _id: result.insertedId,
      ...attendanceData,
    },
  });
}

/* =====================================================
   ENTRY EXISTS, EXIT NOT MARKED
===================================================== */

if (existing.entryTime && !existing.exitTime) {
  const entrySeconds =
    timeToSeconds(existing.entryTime);

  const currentSeconds =
    timeToSeconds(currentTime);

  let elapsedSeconds =
    currentSeconds - entrySeconds;

  // Handle midnight crossing.
  if (elapsedSeconds < 0) {
    elapsedSeconds += 24 * 60 * 60;
  }

  /* -----------------------------------------------
     BLOCK EXIT FOR FIRST 2 MINUTES
  ------------------------------------------------ */

  if (elapsedSeconds < 120) {
    const remainingSeconds =
      120 - elapsedSeconds;

    return res.status(409).json({
      success: false,
      action: "wait_exit",
      remainingSeconds,
      message:
        `Exit scan is available in ${remainingSeconds} second(s).`,
      teacher: getTeacherResponse(teacher),
      attendance: existing,
    });
  }

  /* -----------------------------------------------
     AUTOMATIC EXIT — NO CONFIRMATION
  ------------------------------------------------ */

  const exitTime = getCurrentTime();

  const updateResult = await attendanceCollection.updateOne(
    {
      _id: existing._id,
      teacherId,
      date: today,
      exitTime: null,
    },
    {
      $set: {
        exitTime,
        updatedAt: new Date(),
      },
    }
  );

  if (updateResult.matchedCount === 0) {
    const latest = await attendanceCollection.findOne({
      _id: existing._id,
    });

    if (latest?.exitTime) {
      return res.status(409).json({
        success: false,
        alreadyCompleted: true,
        action: "completed",
        message: "Teacher exit is already recorded.",
        teacher: getTeacherResponse(teacher),
        attendance: latest,
      });
    }

    return res.status(409).json({
      success: false,
      message: "Exit could not be recorded. Scan again.",
    });
  }

  const updatedAttendance =
    await attendanceCollection.findOne({
      _id: existing._id,
    });

  return res.status(200).json({
    success: true,
    action: "exit",
    message: "Teacher exit recorded successfully.",
    teacher: getTeacherResponse(teacher),
    attendance: updatedAttendance,
  });
}

return res.status(400).json({
  success: false,
  message: "Unable to process teacher attendance.",
});


} catch (error) {
console.error("Teacher Attendance Scan Error:", error);


return res.status(500).json({
  success: false,
  message: "Failed to process teacher attendance.",
});


}
};

/* =========================================================
GET TODAY'S TEACHER ATTENDANCE
========================================================= */

const getTodayTeacherAttendance = async (req, res) => {
try {
const db = getDB();


const {
  date = "",
  branch = "",
  status = "",
} = req.query;

const targetDate = date || getTodayDate();

const query = {
  date: targetDate,
};

if (branch) query.branch = branch;
if (status) query.status = status;

const attendance = await db
  .collection("teacherAttendance")
  .find(query)
  .sort({
    branch: 1,
    teacherName: 1,
  })
  .toArray();

return res.status(200).json({
  success: true,
  date: targetDate,
  attendance,
});


} catch (error) {
console.error("Get Teacher Attendance Error:", error);


return res.status(500).json({
  success: false,
  message: "Failed to load teacher attendance.",
});


}
};

/* =========================================================
GET TEACHER ATTENDANCE HISTORY
========================================================= */

const getTeacherAttendanceHistory = async (req, res) => {
try {
const db = getDB();


const {
  teacherId = "",
  fromDate = "",
  toDate = "",
  branch = "",
  status = "",
} = req.query;

const query = {};

if (teacherId) {
  if (!ObjectId.isValid(teacherId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid teacher ID.",
    });
  }

  query.teacherId = new ObjectId(teacherId);
}

if (fromDate || toDate) {
  query.date = {};

  if (fromDate) query.date.$gte = fromDate;
  if (toDate) query.date.$lte = toDate;
}

if (branch) query.branch = branch;
if (status) query.status = status;

const attendance = await db
  .collection("teacherAttendance")
  .find(query)
  .sort({
    date: -1,
    teacherName: 1,
  })
  .toArray();

return res.status(200).json({
  success: true,
  attendance,
});


} catch (error) {
console.error("Teacher Attendance History Error:", error);


return res.status(500).json({
  success: false,
  message: "Failed to load teacher attendance history.",
});


}
};

module.exports = {
scanTeacherAttendance,
getTodayTeacherAttendance,
getTeacherAttendanceHistory,
};
