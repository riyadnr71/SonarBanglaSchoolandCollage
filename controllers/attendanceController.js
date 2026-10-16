
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

/* =========================================================
   DATE / TIME HELPERS
========================================================= */

const getTodayDate = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

const getCurrentTime = () => {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
};

/* =========================================================
   TIME TO MINUTES
========================================================= */

const timeToMinutes = (time) => {
  if (!time) return 0;

  const parts = String(time).split(":");

  const hour = Number(parts[0]) || 0;
  const minute = Number(parts[1]) || 0;

  return hour * 60 + minute;
};

/* =========================================================
   TIME TO SECONDS
========================================================= */

const timeToSeconds = (time) => {
  if (!time) return 0;

  const parts = String(time).split(":");

  const hour = Number(parts[0]) || 0;
  const minute = Number(parts[1]) || 0;
  const second = Number(parts[2]) || 0;

  return (
    hour * 3600 +
    minute * 60 +
    second
  );
};

/* =========================================================
   GET SETTINGS
========================================================= */

const getSettings = async () => {
  const db = getDB();

  let settings = await db
    .collection("attendanceSettings")
    .findOne({});

  if (!settings) {
    settings = {
      season: "Summer",
      attendanceStartTime: "08:00",
      absentAfterTime: "09:00",
      lateAllowed: true,
    };

    await db
      .collection("attendanceSettings")
      .insertOne({
        ...settings,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  }

  return settings;
};

/* =========================================================
   FIND STUDENT FROM QR
========================================================= */

const findStudentFromScan = async (
  scanValue
) => {
  const db = getDB();

  const studentsCollection =
    db.collection("students");

  const value = String(
    scanValue || ""
  ).trim();

  if (!value) return null;

  /* -------------------------------------------------------
     1. ID CARD
  ------------------------------------------------------- */

  let student =
    await studentsCollection.findOne({
      idCard: value,
    });

  if (student) return student;

  /* -------------------------------------------------------
     2. QR CODE
  ------------------------------------------------------- */

  student =
    await studentsCollection.findOne({
      qrCode: value,
    });

  if (student) return student;

  /* -------------------------------------------------------
     3. OBJECT ID
  ------------------------------------------------------- */

  if (ObjectId.isValid(value)) {
    student =
      await studentsCollection.findOne({
        _id: new ObjectId(value),
      });

    if (student) return student;
  }

  /* -------------------------------------------------------
     4. STUDENT URL
  ------------------------------------------------------- */

  const studentUrlMatch =
    value.match(
      /\/student\/([a-fA-F0-9]{24})/
    );

  if (studentUrlMatch) {
    const studentId =
      studentUrlMatch[1];

    student =
      await studentsCollection.findOne({
        _id: new ObjectId(studentId),
      });

    if (student) return student;
  }

  return null;
};

/* =========================================================
   STUDENT RESPONSE
========================================================= */

const getStudentResponse = (
  student
) => {
  return {
    _id: student._id,

    name:
      student.name,

    idCard:
      student.idCard,

    roll:
      student.roll,

    branch:
      student.branch ||
      "Main Branch",

    className:
      student.className,

    section:
      student.section,

    image:
      student.image || null,
  };
};

/* =========================================================
   SCAN ATTENDANCE
========================================================= */

const scanAttendance = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const {
      scanValue,
      confirmExit = false,
    } = req.body || {};

    if (!scanValue) {
      return res.status(400).json({
        success: false,
        message:
          "QR code value is required.",
      });
    }

    /* -------------------------------------------------------
       FIND STUDENT
    ------------------------------------------------------- */

    const student =
      await findStudentFromScan(
        scanValue
      );

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found.",
      });
    }

    /* -------------------------------------------------------
       ACTIVE STUDENT CHECK
    ------------------------------------------------------- */

    if (
      student.status &&
      String(
        student.status
      ).toLowerCase() !==
        "active"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This student is not active.",
      });
    }

    const today =
      getTodayDate();

    const currentTime =
      getCurrentTime();

    /* -------------------------------------------------------
       FIND TODAY ATTENDANCE
    ------------------------------------------------------- */

    const existingAttendance =
      await db
        .collection("attendance")
        .findOne({
          studentId:
            student._id,
          date: today,
        });

    /* =======================================================
       LEAVE CHECK
    ======================================================= */

    if (
      existingAttendance &&
      existingAttendance.status ===
        "Leave"
    ) {
      return res.status(409).json({
        success: false,
        isLeave: true,
        action: "leave",
        message:
          "This student is on leave today.",
        student:
          getStudentResponse(
            student
          ),
        attendance:
          existingAttendance,
      });
    }

    /* =======================================================
       ALREADY COMPLETED
    ======================================================= */

    if (
      existingAttendance &&
      existingAttendance.entryTime &&
      existingAttendance.exitTime
    ) {
      return res.status(409).json({
        success: false,
        alreadyCompleted: true,
        action: "completed",
        message:
          "Attendance entry and exit are already completed for today.",
        student:
          getStudentResponse(
            student
          ),
        attendance:
          existingAttendance,
      });
    }

    /* -------------------------------------------------------
       GET SETTINGS
    ------------------------------------------------------- */

    const settings =
      await getSettings();

    const currentMinutes =
      timeToMinutes(
        currentTime
      );

    const startMinutes =
      timeToMinutes(
        settings.attendanceStartTime ||
          "08:00"
      );

    const absentAfterMinutes =
      timeToMinutes(
        settings.absentAfterTime ||
          "09:00"
      );

    /* =======================================================
       BEFORE ATTENDANCE START
    ======================================================= */

    if (
      currentMinutes <
      startMinutes
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Attendance has not started yet. Attendance starts at ${settings.attendanceStartTime}.`,
        student:
          getStudentResponse(
            student
          ),
      });
    }

    /* =======================================================
       FIRST SCAN → ENTRY
    ======================================================= */

    if (!existingAttendance) {
      let status = "Present";

      if (
        currentMinutes >=
        absentAfterMinutes
      ) {
        if (
          settings.lateAllowed !==
          false
        ) {
          status = "Late";
        } else {
          return res.status(403).json({
            success: false,
            message:
              "Attendance time is over. Late attendance is not allowed.",
            student:
              getStudentResponse(
                student
              ),
          });
        }
      }

      /* =====================================================
         ATTENDANCE DATA
      ===================================================== */

      const attendanceData = {
        studentId:
          student._id,

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

        date: today,

        entryTime:
          currentTime,

        exitTime: null,

        status,

        leaveReason: "",

        createdAt:
          new Date(),

        updatedAt:
          new Date(),
      };

      /* =====================================================
         INSERT
      ===================================================== */

      const result =
        await db
          .collection(
            "attendance"
          )
          .insertOne(
            attendanceData
          );

      const savedAttendance = {
        _id:
          result.insertedId,

        ...attendanceData,
      };

      return res.status(200).json({
        success: true,
        action: "entry",
        message:
          status === "Late"
            ? "Late attendance marked successfully."
            : "Attendance entry marked successfully.",
        student:
          getStudentResponse(
            student
          ),
        attendance:
          savedAttendance,
      });
    }

    /* =======================================================
       EXISTING ENTRY → EXIT FLOW
    ======================================================= */

    if (
      existingAttendance.entryTime &&
      !existingAttendance.exitTime
    ) {
      /* -----------------------------------------------------
         CALCULATE TIME FROM ENTRY
      ----------------------------------------------------- */

      const entrySeconds =
        timeToSeconds(
          existingAttendance.entryTime
        );

      const currentSeconds =
        timeToSeconds(
          currentTime
        );

      let elapsedSeconds =
        currentSeconds -
        entrySeconds;

      /* -----------------------------------------------------
         MIDNIGHT PROTECTION
      ----------------------------------------------------- */

      if (elapsedSeconds < 0) {
        elapsedSeconds +=
          24 * 60 * 60;
      }

      /* =====================================================
         LESS THAN 2 MINUTES
      ===================================================== */

      if (
        elapsedSeconds < 120
      ) {
        const remainingSeconds =
          120 -
          elapsedSeconds;

        const remainingMinutes =
          Math.ceil(
            remainingSeconds / 60
          );

        return res.status(409).json({
          success: false,
          action: "wait_exit",
          message:
            `Exit scan is available after ${remainingMinutes} minute${
              remainingMinutes > 1
                ? "s"
                : ""
            }.`,
          student:
            getStudentResponse(
              student
            ),
          attendance:
            existingAttendance,
        });
      }

      /* =====================================================
         SECOND SCAN WITHOUT CONFIRMATION
      ===================================================== */

      if (!confirmExit) {
        return res.status(200).json({
          success: true,
          action:
            "confirm-exit",
          requiresExitConfirmation:
            true,
          message:
            "Student entry found. Confirm exit.",
          student:
            getStudentResponse(
              student
            ),
          attendance:
            existingAttendance,
        });
      }

      /* =====================================================
         CONFIRM EXIT
      ===================================================== */

      const exitTime =
        getCurrentTime();

      const updateResult =
        await db
          .collection("attendance")
          .updateOne(
            {
              _id:
                existingAttendance._id,

              studentId:
                student._id,

              date: today,

              exitTime: null,
            },
            {
              $set: {
                exitTime,

                updatedAt:
                  new Date(),
              },
            }
          );

      /* -----------------------------------------------------
         UPDATE FAILED
      ----------------------------------------------------- */

      if (
        updateResult.matchedCount ===
        0
      ) {
        const latestAttendance =
          await db
            .collection(
              "attendance"
            )
            .findOne({
              _id:
                existingAttendance._id,
            });

        if (
          latestAttendance &&
          latestAttendance.exitTime
        ) {
          return res.status(409).json({
            success: false,
            alreadyCompleted:
              true,
            action:
              "completed",
            message:
              "Attendance exit is already completed.",
            student:
              getStudentResponse(
                student
              ),
            attendance:
              latestAttendance,
          });
        }

        return res.status(409).json({
          success: false,
          message:
            "Exit could not be marked. Please scan again.",
        });
      }

      /* -----------------------------------------------------
         GET UPDATED DOCUMENT
      ----------------------------------------------------- */

      const updatedAttendance =
        await db
          .collection(
            "attendance"
          )
          .findOne({
            _id:
              existingAttendance._id,
          });

      return res.status(200).json({
        success: true,
        action: "exit",
        message:
          "Exit time marked successfully.",
        student:
          getStudentResponse(
            student
          ),
        attendance:
          updatedAttendance,
      });
    }

    return res.status(400).json({
      success: false,
      message:
        "Unable to process attendance.",
    });
  } catch (error) {
    console.error(
      "❌ Scan Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to process attendance.",
    });
  }
};

/* =========================================================
   GET TODAY ATTENDANCE
========================================================= */

const getTodayAttendance = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const {
      branch = "",
      className = "",
      date = "",
    } = req.query;

    const targetDate =
      date || getTodayDate();

    const query = {
      date: targetDate,
    };

    if (branch) {
      query.branch = branch;
    }

    if (className) {
      query.className =
        className;
    }

    const attendance =
      await db
        .collection("attendance")
        .find(query)
        .sort({
          className: 1,
          studentName: 1,
        })
        .toArray();

    return res.status(200).json({
      success: true,
      date: targetDate,
      attendance,
    });
  } catch (error) {
    console.error(
      "❌ Get Today Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load attendance.",
    });
  }
};

/* =========================================================
   GET STUDENT ATTENDANCE
========================================================= */

const getStudentAttendance = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const { studentId } =
      req.params;

    if (
      !ObjectId.isValid(
        studentId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid student ID.",
      });
    }

    const student =
      await db
        .collection("students")
        .findOne({
          _id:
            new ObjectId(
              studentId
            ),
        });

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found.",
      });
    }

    const attendance =
      await db
        .collection("attendance")
        .find({
          studentId:
            student._id,
        })
        .sort({
          date: -1,
        })
        .toArray();

    return res.status(200).json({
      success: true,
      student:
        getStudentResponse(
          student
        ),
      attendance,
    });
  } catch (error) {
    console.error(
      "❌ Get Student Attendance Error:",
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
   GET CLASS ATTENDANCE
========================================================= */

const getClassAttendance = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const { className } =
      req.params;

    const {
      branch = "",
      date = "",
    } = req.query;

    if (!className) {
      return res.status(400).json({
        success: false,
        message:
          "Class name is required.",
      });
    }

    const query = {
      className,

      date:
        date ||
        getTodayDate(),
    };

    if (branch) {
      query.branch = branch;
    }

    const attendance =
      await db
        .collection("attendance")
        .find(query)
        .sort({
          studentName: 1,
        })
        .toArray();

    return res.status(200).json({
      success: true,
      className,
      branch,
      date:
        date ||
        getTodayDate(),
      attendance,
    });
  } catch (error) {
    console.error(
      "❌ Get Class Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load class attendance.",
    });
  }
};

/* =========================================================
   MARK LEAVE
========================================================= */

const markLeave = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const {
      studentId,
      date = getTodayDate(),
      leaveReason = "",
    } = req.body || {};

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message:
          "Student ID is required.",
      });
    }

    if (
      !ObjectId.isValid(
        studentId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid student ID.",
      });
    }

    const student =
      await db
        .collection("students")
        .findOne({
          _id:
            new ObjectId(
              studentId
            ),
        });

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found.",
      });
    }

    const existing =
      await db
        .collection("attendance")
        .findOne({
          studentId:
            student._id,
          date,
        });

    /* -------------------------------------------------------
       ALREADY PRESENT
    ------------------------------------------------------- */

    if (
      existing &&
      (
        existing.status ===
          "Present" ||
        existing.status ===
          "Late"
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This student already has attendance for this date. You cannot mark leave.",
        attendance:
          existing,
      });
    }

    /* -------------------------------------------------------
       ALREADY LEAVE
    ------------------------------------------------------- */

    if (
      existing &&
      existing.status ===
        "Leave"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Leave is already marked for this student.",
        attendance:
          existing,
      });
    }

    /* =====================================================
       LEAVE DATA
    ===================================================== */

    const leaveData = {
      studentId:
        student._id,

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

      status: "Leave",

      leaveReason:
        String(
          leaveReason || ""
        ).trim(),

      createdAt:
        new Date(),

      updatedAt:
        new Date(),
    };

    const result =
      await db
        .collection("attendance")
        .insertOne(
          leaveData
        );

    return res.status(201).json({
      success: true,
      message:
        "Leave marked successfully.",
      attendance: {
        _id:
          result.insertedId,

        ...leaveData,
      },
    });
  } catch (error) {
    console.error(
      "❌ Mark Leave Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark leave.",
    });
  }
};

/* =========================================================
   UPDATE ATTENDANCE
========================================================= */

const updateAttendance = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const { id } =
      req.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid attendance ID.",
      });
    }

    const {
      entryTime,
      exitTime,
      status,
      leaveReason,
      branch,
    } = req.body || {};

    const updateData = {
      updatedAt:
        new Date(),
    };

    if (
      entryTime !== undefined
    ) {
      updateData.entryTime =
        entryTime || null;
    }

    if (
      exitTime !== undefined
    ) {
      updateData.exitTime =
        exitTime || null;
    }

    if (
      status !== undefined
    ) {
      updateData.status =
        status;
    }

    if (
      leaveReason !==
      undefined
    ) {
      updateData.leaveReason =
        leaveReason || "";
    }

    if (
      branch !== undefined
    ) {
      updateData.branch =
        branch ||
        "Main Branch";
    }

    const result =
      await db
        .collection("attendance")
        .findOneAndUpdate(
          {
            _id:
              new ObjectId(id),
          },
          {
            $set:
              updateData,
          },
          {
            returnDocument:
              "after",
          }
        );

    const attendance =
      result.value ||
      result;

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message:
          "Attendance record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Attendance updated successfully.",
      attendance,
    });
  } catch (error) {
    console.error(
      "❌ Update Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update attendance.",
    });
  }
};

/* =========================================================
   DELETE ATTENDANCE
========================================================= */

const deleteAttendance = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const { id } =
      req.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid attendance ID.",
      });
    }

    const result =
      await db
        .collection("attendance")
        .deleteOne({
          _id:
            new ObjectId(id),
        });

    if (
      !result.deletedCount
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Attendance record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Attendance deleted successfully.",
      deletedCount:
        result.deletedCount,
    });
  } catch (error) {
    console.error(
      "❌ Delete Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete attendance.",
    });
  }
};

/* =========================================================
   BULK DELETE ATTENDANCE
========================================================= */

const bulkDeleteAttendance = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const {
      fromDate,
      toDate,
      branch = "",
      className = "",
    } = req.body || {};

    /* -------------------------------------------------------
       DATE VALIDATION
    ------------------------------------------------------- */

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message:
          "From date and To date are required.",
      });
    }

    if (fromDate > toDate) {
      return res.status(400).json({
        success: false,
        message:
          "From date cannot be greater than to date.",
      });
    }

    /* -------------------------------------------------------
       BUILD DELETE QUERY
    ------------------------------------------------------- */

    const query = {
      date: {
        $gte: fromDate,
        $lte: toDate,
      },
    };

    if (branch) {
      query.branch = branch;
    }

    if (className) {
      query.className = className;
    }

    /* -------------------------------------------------------
       DELETE REAL DATABASE RECORDS ONLY
    ------------------------------------------------------- */

    const result =
      await db
        .collection("attendance")
        .deleteMany(query);

    return res.status(200).json({
      success: true,
      message:
        `${result.deletedCount} attendance record(s) deleted successfully.`,
      deletedCount:
        result.deletedCount,
      filters: {
        fromDate,
        toDate,
        branch,
        className,
      },
    });
  } catch (error) {
    console.error(
      "❌ Bulk Delete Attendance Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete attendance records.",
    });
  }
};

/* =========================================================
   GET ATTENDANCE REPORT
========================================================= */

const getAttendanceReport = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const {
      branch = "",
      className = "",
      fromDate = "",
      toDate = "",
    } = req.query;

    const startDate =
      fromDate ||
      getTodayDate();

    const endDate =
      toDate ||
      startDate;

    if (
      startDate > endDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "From date cannot be greater than to date.",
      });
    }

    /* -------------------------------------------------------
       STUDENTS
    ------------------------------------------------------- */

    const studentQuery = {
      status: {
        $regex: /^active$/i,
      },
    };

    if (branch) {
      studentQuery.branch =
        branch;
    }

    if (className) {
      studentQuery.className =
        className;
    }

    const students =
      await db
        .collection("students")
        .find(studentQuery)
        .sort({
          className: 1,
          roll: 1,
          name: 1,
        })
        .toArray();

    /* -------------------------------------------------------
       ATTENDANCE RECORDS
    ------------------------------------------------------- */

    const attendanceQuery = {
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    if (branch) {
      attendanceQuery.branch =
        branch;
    }

    if (className) {
      attendanceQuery.className =
        className;
    }

    const attendanceRecords =
      await db
        .collection("attendance")
        .find(
          attendanceQuery
        )
        .toArray();

    /* -------------------------------------------------------
       ATTENDANCE MAP
    ------------------------------------------------------- */

    const attendanceMap =
      new Map();

    attendanceRecords.forEach(
      (record) => {
        const key =
          `${record.studentId}_${record.date}`;

        attendanceMap.set(
          key,
          record
        );
      }
    );

    /* -------------------------------------------------------
       DATE RANGE
    ------------------------------------------------------- */

    const generateDates = (
      start,
      end
    ) => {
      const dates = [];

      const current =
        new Date(
          `${start}T00:00:00`
        );

      const last =
        new Date(
          `${end}T00:00:00`
        );

      while (
        current <= last
      ) {
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

        dates.push(
          `${year}-${month}-${day}`
        );

        current.setDate(
          current.getDate() + 1
        );
      }

      return dates;
    };

    const dates =
      generateDates(
        startDate,
        endDate
      );

    /* -------------------------------------------------------
       BUILD REPORT
    ------------------------------------------------------- */

    const report = [];

    dates.forEach(
      (date) => {
        students.forEach(
          (student) => {
            const key =
              `${student._id}_${date}`;

            const attendance =
              attendanceMap.get(
                key
              );

            let status =
              "Absent";

            let entryTime =
              null;

            let exitTime =
              null;

            let leaveReason =
              "";

            let virtual = true;

            let attendanceId =
              null;

            if (attendance) {
              status =
                attendance.status ||
                "Present";

              entryTime =
                attendance.entryTime ||
                null;

              exitTime =
                attendance.exitTime ||
                null;

              leaveReason =
                attendance.leaveReason ||
                "";

              virtual = false;

              attendanceId =
                attendance._id;
            }

            report.push({
              _id:
                attendanceId ||
                `virtual-${student._id}-${date}`,

              date,

              studentId:
                student._id,

              studentIdCard:
                student.idCard ||
                "",

              studentName:
                student.name ||
                "",

              roll:
                student.roll ||
                "",

              branch:
                student.branch ||
                "Main Branch",

              className:
                student.className ||
                "",

              section:
                student.section ||
                "",

              entryTime,

              exitTime,

              status,

              leaveReason,

              virtual,
            });
          }
        );
      }
    );

    /* -------------------------------------------------------
       SUMMARY
    ------------------------------------------------------- */

    const summary = {
      total:
        report.length,

      present:
        report.filter(
          (item) =>
            item.status ===
            "Present"
        ).length,

      late:
        report.filter(
          (item) =>
            item.status ===
            "Late"
        ).length,

      leave:
        report.filter(
          (item) =>
            item.status ===
            "Leave"
        ).length,

      absent:
        report.filter(
          (item) =>
            item.status ===
            "Absent"
        ).length,
    };

    return res.status(200).json({
      success: true,

      filters: {
        branch,
        className,
        fromDate:
          startDate,
        toDate:
          endDate,
      },

      summary,

      report,
    });
  } catch (error) {
    console.error(
      "❌ Get Attendance Report Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate attendance report.",
    });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  scanAttendance,
  getTodayAttendance,
  getStudentAttendance,
  getClassAttendance,
  markLeave,
  updateAttendance,
  deleteAttendance,
  bulkDeleteAttendance,
  getAttendanceReport,
};

