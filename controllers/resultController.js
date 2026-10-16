const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");

/* =========================================================
   GRADE CALCULATOR
========================================================= */

const calculateGrade = (percentage) => {
  const p = Number(percentage);

  if (p >= 80) return "A+";
  if (p >= 70) return "A";
  if (p >= 60) return "A-";
  if (p >= 50) return "B";
  if (p >= 40) return "C";
  if (p >= 33) return "D";

  return "F";
};

/* =========================================================
   GPA CALCULATOR
========================================================= */

const calculateGPA = (grade) => {
  const gradePoints = {
    "A+": 5.0,
    A: 4.0,
    "A-": 3.5,
    B: 3.0,
    C: 2.0,
    D: 1.0,
    F: 0.0,
  };

  return gradePoints[grade] ?? 0;
};



/* =========================================================
   TEACHER RESULT ACCESS HELPERS
========================================================= */

const isTeacherRequest = (req) => {
  return req.teacher || req.teacherData;
};

const getTeacherData = (req) => {
  return req.teacherData || {};
};

/* =========================================================
   CHECK RESULT PERMISSION
========================================================= */

const hasResultPermission = (
  req,
  action
) => {
  if (!isTeacherRequest(req)) {
    return true;
  }

  const teacher =
    getTeacherData(req);

  return (
    teacher.permissions?.results?.[
      action
    ] === true
  );
};

/* =========================================================
   CHECK ACADEMIC RESULT ACCESS
========================================================= */

const teacherCanAccessResult = (
  req,
  student,
  subjectNames = []
) => {
  if (!isTeacherRequest(req)) {
    return true;
  }

  const teacher =
    getTeacherData(req);

  const accessList =
    Array.isArray(
      teacher.academicAccess
    )
      ? teacher.academicAccess
      : [];

  if (!accessList.length) {
    return false;
  }

  const studentBranch =
    String(
      student.branch || ""
    ).trim();

  const studentClass =
    String(
      student.className || ""
    ).trim();

  const studentSection =
    String(
      student.section || ""
    ).trim();

  return accessList.some(
    (access) => {
      const accessBranch =
        String(
          access.branch || ""
        ).trim();

      const accessClass =
        String(
          access.className || ""
        ).trim();

      const accessSection =
        String(
          access.section || ""
        ).trim();

      /* -----------------------------------------
         BRANCH
      ----------------------------------------- */

      if (
        accessBranch !==
        studentBranch
      ) {
        return false;
      }

      /* -----------------------------------------
         CLASS
      ----------------------------------------- */

      if (
        accessClass !==
        studentClass
      ) {
        return false;
      }

      /* -----------------------------------------
         SECTION
         Blank = all sections
      ----------------------------------------- */

      if (
        accessSection &&
        accessSection !==
          studentSection
      ) {
        return false;
      }

      /* -----------------------------------------
         SUBJECT
      ----------------------------------------- */

      const allowedSubjects =
        Array.isArray(
          access.subjects
        )
          ? access.subjects
          : [];

      if (
        !allowedSubjects.length
      ) {
        return false;
      }

      return subjectNames.every(
        (subjectName) =>
          allowedSubjects.includes(
            String(
              subjectName || ""
            ).trim()
          )
      );
    }
  );
};

/* =========================================================
   GET TEACHER ACCESSIBLE SUBJECT NAMES
========================================================= */

const getTeacherAllowedSubjects = (
  req,
  student
) => {
  if (!isTeacherRequest(req)) {
    return null;
  }

  const teacher =
    getTeacherData(req);

  const accessList =
    Array.isArray(
      teacher.academicAccess
    )
      ? teacher.academicAccess
      : [];

  const allowed = new Set();

  accessList.forEach(
    (access) => {
      const branch =
        String(
          access.branch || ""
        ).trim();

      const className =
        String(
          access.className || ""
        ).trim();

      const section =
        String(
          access.section || ""
        ).trim();

      if (
        branch !==
        String(
          student.branch || ""
        ).trim()
      ) {
        return;
      }

      if (
        className !==
        String(
          student.className || ""
        ).trim()
      ) {
        return;
      }

      if (
        section &&
        section !==
          String(
            student.section || ""
          ).trim()
      ) {
        return;
      }

      if (
        Array.isArray(
          access.subjects
        )
      ) {
        access.subjects.forEach(
          (subject) =>
            allowed.add(
              String(
                subject
              ).trim()
            )
        );
      }
    }
  );

  return [...allowed];
};

/* =========================================================
   GET STUDENT PHOTO
   নতুন + পুরনো result দুই ক্ষেত্রেই কাজ করবে
========================================================= */

const getStudentPhoto = async (
  studentsCollection,
  result
) => {
  /* -------------------------------------------------------
     প্রথমে result document-এর saved photo দেখবে
  ------------------------------------------------------- */

  if (
    typeof result.studentPhoto === "string" &&
    result.studentPhoto.trim() !== ""
  ) {
    return result.studentPhoto;
  }

  /* -------------------------------------------------------
     পুরনো result হলে studentId দিয়ে students collection
     থেকে photo নিয়ে আসবে
  ------------------------------------------------------- */

  if (!result.studentId) {
    return "";
  }

  try {
    let studentObjectId;

    if (
      result.studentId instanceof ObjectId
    ) {
      studentObjectId =
        result.studentId;
    } else if (
      ObjectId.isValid(
        String(result.studentId)
      )
    ) {
      studentObjectId =
        new ObjectId(
          String(result.studentId)
        );
    } else {
      return "";
    }

    const student =
      await studentsCollection.findOne({
        _id: studentObjectId,
      });

    if (!student) {
      return "";
    }

    return (
      student.image ||
      ""
    );
  } catch (error) {
    console.error(
      "Get Student Photo Error:",
      error.message
    );

    return "";
  }
};

/* =========================================================
   ADD RESULT
========================================================= */

const addResult = async (req, res) => {
  try {
    const db = getDB();

    const studentsCollection =
      db.collection("students");

    const subjectsCollection =
      db.collection("subjects");

    const resultsCollection =
      db.collection("results");

    const {
      studentId,
      month,
      examName,
      year,
      marks,
      session,
      aPlusRequired,
    } = req.body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (
      !studentId ||
      !month ||
      !examName ||
      !year ||
      !marks ||
      typeof marks !== "object" ||
      Array.isArray(marks)
    ) {
      return res.status(400).send({
        success: false,
        message:
          "Student, month, exam, year and marks are required",
      });
    }

    if (!ObjectId.isValid(studentId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid student ID",
      });
    }

    const cleanMonth =
      String(month).trim();

    const cleanExamName =
      String(examName).trim();

    const cleanYear =
      String(year).trim();

    if (!cleanMonth) {
      return res.status(400).send({
        success: false,
        message: "Month is required",
      });
    }

    if (!cleanExamName) {
      return res.status(400).send({
        success: false,
        message: "Exam name is required",
      });
    }

    if (!cleanYear) {
      return res.status(400).send({
        success: false,
        message: "Year is required",
      });
    }

    /* =====================================================
       FIND STUDENT
    ===================================================== */

    const student =
      await studentsCollection.findOne({
        _id: new ObjectId(studentId),
      });

    if (!student) {
      return res.status(404).send({
        success: false,
        message: "Student not found",
      });
    }

    /* =====================================================
       GET CLASS SUBJECTS
    ===================================================== */

    const subjects =
      await subjectsCollection
        .find({
          className:
            student.className,
        })
        .sort({
          subjectName: 1,
        })
        .toArray();

    if (!subjects.length) {
      return res.status(400).send({
        success: false,
        message:
          "No subjects found for this class",
      });
    }

    /* =====================================================
       A+ REQUIRED SUBJECTS
    ===================================================== */

    const totalSubjects =
      subjects.length;

    let requiredAPlus =
      Number(aPlusRequired);

    if (
      !Number.isInteger(
        requiredAPlus
      )
    ) {
      requiredAPlus =
        totalSubjects;
    }

    if (
      requiredAPlus < 1 ||
      requiredAPlus >
        totalSubjects
    ) {
      return res.status(400).send({
        success: false,
        message:
          `A+ Required Subjects must be between 1 and ${totalSubjects}`,
      });
    }

    /* =====================================================
       SESSION
    ===================================================== */

    const cleanSession =
      session !== undefined &&
      session !== null
        ? String(session).trim()
        : String(
            student.session || ""
          ).trim();

    /* =====================================================
       DUPLICATE RESULT CHECK
    ===================================================== */

    const existingResult =
      await resultsCollection.findOne({
        studentId:
          student._id,

        month:
          cleanMonth,

        examName:
          cleanExamName,

        year:
          cleanYear,
      });

    if (existingResult) {
      return res.status(409).send({
        success: false,
        message:
          "Result for this student, month, exam and year already exists",
      });
    }

    /* =====================================================
       CALCULATION VARIABLES
    ===================================================== */

    let totalMarks = 0;
    let totalFullMarks = 0;
    let hasFailed = false;
    let aPlusCount = 0;

    const resultSubjects = [];

    /* =====================================================
       SUBJECT LOOP
    ===================================================== */

    for (const subject of subjects) {
      const subjectId =
        subject._id.toString();

      const subjectInput =
        marks[subjectId];

      if (
        subjectInput ===
          undefined ||
        subjectInput === null
      ) {
        return res.status(400).send({
          success: false,
          message:
            `Marks are required for ${subject.subjectName}`,
        });
      }

      /* ---------------------------------------------------
         GET MARKS
      --------------------------------------------------- */

      let obtained;
      let fullMarks;
      let passMarks;

      if (
        typeof subjectInput ===
          "object" &&
        !Array.isArray(
          subjectInput
        )
      ) {
        obtained = Number(
          subjectInput.obtainedMarks
        );

        fullMarks = Number(
          subjectInput.fullMarks
        );

        passMarks =
          subjectInput.passMarks !==
            undefined &&
          subjectInput.passMarks !==
            ""
            ? Number(
                subjectInput.passMarks
              )
            : Number(
                subject.passMarks
              );
      } else {
        obtained = Number(
          subjectInput
        );

        fullMarks = Number(
          subject.fullMarks
        );

        passMarks = Number(
          subject.passMarks
        );
      }

      /* ---------------------------------------------------
         FULL MARKS FALLBACK
      --------------------------------------------------- */

      if (
        !Number.isFinite(
          fullMarks
        ) ||
        fullMarks <= 0
      ) {
        fullMarks = Number(
          subject.fullMarks
        );
      }

      if (
        !Number.isFinite(
          fullMarks
        ) ||
        fullMarks <= 0
      ) {
        return res.status(400).send({
          success: false,
          message:
            `${subject.subjectName} has invalid full marks`,
        });
      }

      /* ---------------------------------------------------
         PASS MARKS FALLBACK
      --------------------------------------------------- */

      if (
        !Number.isFinite(
          passMarks
        ) ||
        passMarks < 0
      ) {
        passMarks =
          Math.ceil(
            fullMarks * 0.33
          );
      }

      /* ---------------------------------------------------
         VALIDATE PASS MARKS
      --------------------------------------------------- */

      if (
        passMarks >
        fullMarks
      ) {
        return res.status(400).send({
          success: false,
          message:
            `${subject.subjectName}: Pass marks cannot exceed ${fullMarks}`,
        });
      }

      /* ---------------------------------------------------
         VALIDATE OBTAINED
      --------------------------------------------------- */

      if (
        !Number.isFinite(
          obtained
        ) ||
        obtained < 0
      ) {
        return res.status(400).send({
          success: false,
          message:
            `Invalid marks for ${subject.subjectName}`,
        });
      }

      if (
        obtained >
        fullMarks
      ) {
        return res.status(400).send({
          success: false,
          message:
            `${subject.subjectName} marks cannot exceed ${fullMarks}`,
        });
      }

      /* ===================================================
         PERCENTAGE
      =================================================== */

      const percentage =
        (obtained /
          fullMarks) *
        100;

      /* ===================================================
         GRADE
      =================================================== */

      const grade =
        calculateGrade(
          percentage
        );

      const gradePoint =
        calculateGPA(grade);

      /* ===================================================
         STATUS
      =================================================== */

      const subjectStatus =
        obtained >= passMarks
          ? "Pass"
          : "Fail";

      if (
        subjectStatus ===
        "Fail"
      ) {
        hasFailed = true;
      }

      /* ===================================================
         A+ COUNT
      =================================================== */

      if (
        grade === "A+"
      ) {
        aPlusCount++;
      }

      /* ===================================================
         TOTAL
      =================================================== */

      totalMarks +=
        obtained;

      totalFullMarks +=
        fullMarks;

      /* ===================================================
         SUBJECT RESULT
      =================================================== */

      resultSubjects.push({
        subjectId:
          subject._id,

        subjectName:
          subject.subjectName ||
          subject.name ||
          "Subject",

        fullMarks,

        passMarks,

        obtainedMarks:
          obtained,

        percentage:
          Number(
            percentage.toFixed(2)
          ),

        grade,

        gradePoint,

        status:
          subjectStatus,
      });
    }

    /* =====================================================
       OVERALL PERCENTAGE
    ===================================================== */

    const overallPercentage =
      totalFullMarks > 0
        ? (totalMarks /
            totalFullMarks) *
          100
        : 0;

    /* =====================================================
       OVERALL GRADE
    ===================================================== */

    let overallGrade;

    if (
      !hasFailed &&
      aPlusCount >=
        requiredAPlus
    ) {
      overallGrade =
        "A+";
    } else {
      overallGrade =
        calculateGrade(
          overallPercentage
        );
    }

    /* =====================================================
       OVERALL GPA
    ===================================================== */

    const totalGradePoints =
      resultSubjects.reduce(
        (
          sum,
          subject
        ) =>
          sum +
          Number(
            subject.gradePoint ||
              0
          ),
        0
      );

    let gpa =
      resultSubjects.length >
      0
        ? totalGradePoints /
          resultSubjects.length
        : 0;

    if (
      !hasFailed &&
      aPlusCount >=
        requiredAPlus
    ) {
      gpa = 5;
    }

    /* =====================================================
       FINAL STATUS
    ===================================================== */

    const status =
      hasFailed
        ? "Fail"
        : "Pass";

    /* =====================================================
       RESULT DOCUMENT
    ===================================================== */

    const now =
      new Date();

    const resultData = {
      studentId:
        student._id,

      studentName:
        student.name ||
        student.studentName ||
        "",

      studentIdCard:
        student.idCard || "",

      /* =================================================
         STUDENT PHOTO
      ================================================= */

      studentPhoto:
        student.image || "",

      roll:
        student.roll || "",

      className:
        student.className ||
        "",

      session:
        cleanSession,

      month:
        cleanMonth,

      examName:
        cleanExamName,

      year:
        cleanYear,

      subjects:
        resultSubjects,

      totalSubjects,

      aPlusRequired:
        requiredAPlus,

      aPlusCount,

      totalMarks,

      totalFullMarks,

      percentage:
        Number(
          overallPercentage.toFixed(
            2
          )
        ),

      grade:
        overallGrade,

      gpa:
        Number(
          gpa.toFixed(2)
        ),

      status,

      createdAt:
        now,

      updatedAt:
        now,
    };

    /* =====================================================
       INSERT
    ===================================================== */

    const inserted =
      await resultsCollection.insertOne(
        resultData
      );

    return res.status(201).send({
      success: true,

      message:
        "Result added successfully",

      result: {
        _id:
          inserted.insertedId,

        ...resultData,
      },
    });
  } catch (error) {
    console.error(
      "Add Result Error:",
      error
    );

    return res.status(500).send({
      success: false,
      message:
        error.message ||
        "Failed to add result",
    });
  }
};

/* =========================================================
   GET RESULTS
   পুরনো result-এর জন্যও student photo attach করবে
========================================================= */

const getResults = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const resultsCollection =
      db.collection("results");

    const studentsCollection =
      db.collection("students");

    const results =
      await resultsCollection
        .find({})
        .sort({
          createdAt: -1,
        })
        .toArray();

    /* =====================================================
       ATTACH STUDENT PHOTO
    ===================================================== */

    const resultsWithPhoto =
      await Promise.all(
        results.map(
          async (result) => {
            const studentPhoto =
              await getStudentPhoto(
                studentsCollection,
                result
              );

            return {
              ...result,
              studentPhoto,
            };
          }
        )
      );

    return res.send({
      success: true,
      data:
        resultsWithPhoto,
    });
  } catch (error) {
    console.error(
      "Get Results Error:",
      error
    );

    return res.status(500).send({
      success: false,
      message:
        "Failed to load results",
    });
  }
};

/* =========================================================
   GET SINGLE RESULT
========================================================= */

const getResultById = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const resultsCollection =
      db.collection("results");

    const studentsCollection =
      db.collection("students");

    const { id } =
      req.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).send({
        success: false,
        message:
          "Invalid result ID",
      });
    }

    const result =
      await resultsCollection.findOne({
        _id:
          new ObjectId(id),
      });

    if (!result) {
      return res.status(404).send({
        success: false,
        message:
          "Result not found",
      });
    }

    /* =====================================================
       STUDENT PHOTO
    ===================================================== */

    const studentPhoto =
      await getStudentPhoto(
        studentsCollection,
        result
      );

    const resultWithPhoto = {
      ...result,
      studentPhoto,
    };

    return res.send({
      success: true,
      data:
        resultWithPhoto,
    });
  } catch (error) {
    console.error(
      "Get Result Error:",
      error
    );

    return res.status(500).send({
      success: false,
      message:
        "Failed to load result",
    });
  }
};

/* =========================================================
   UPDATE RESULT
========================================================= */

const updateResult = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const resultsCollection =
      db.collection("results");

    const studentsCollection =
      db.collection("students");

    const { id } =
      req.params;

    /* =====================================================
       VALIDATE ID
    ===================================================== */

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).send({
        success: false,
        message:
          "Invalid result ID",
      });
    }

    /* =====================================================
       FIND EXISTING RESULT
    ===================================================== */

    const existingResult =
      await resultsCollection.findOne({
        _id:
          new ObjectId(id),
      });

    if (!existingResult) {
      return res.status(404).send({
        success: false,
        message:
          "Result not found",
      });
    }

    /* =====================================================
       REQUEST DATA
    ===================================================== */

    const {
      month,
      examName,
      year,
      session,
      subjects,
      aPlusRequired,
    } = req.body;

    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

    const cleanMonth =
      String(
        month ??
          existingResult.month ??
          ""
      ).trim();

    const cleanExamName =
      String(
        examName ??
          existingResult.examName ??
          ""
      ).trim();

    const cleanYear =
      String(
        year ??
          existingResult.year ??
          ""
      ).trim();

    if (!cleanMonth) {
      return res.status(400).send({
        success: false,
        message:
          "Month is required",
      });
    }

    if (!cleanExamName) {
      return res.status(400).send({
        success: false,
        message:
          "Exam name is required",
      });
    }

    if (!cleanYear) {
      return res.status(400).send({
        success: false,
        message:
          "Year is required",
      });
    }

    /* =====================================================
       SUBJECT VALIDATION
    ===================================================== */

    if (
      !Array.isArray(subjects) ||
      subjects.length === 0
    ) {
      return res.status(400).send({
        success: false,
        message:
          "Subject marks are required",
      });
    }

    /* =====================================================
       A+ REQUIRED
    ===================================================== */

    const totalSubjects =
      subjects.length;

    let requiredAPlus;

    if (
      aPlusRequired !==
        undefined &&
      aPlusRequired !==
        null &&
      aPlusRequired !== ""
    ) {
      requiredAPlus =
        Number(
          aPlusRequired
        );
    } else {
      requiredAPlus =
        Number(
          existingResult.aPlusRequired
        );
    }

    if (
      !Number.isInteger(
        requiredAPlus
      )
    ) {
      requiredAPlus =
        totalSubjects;
    }

    if (
      requiredAPlus < 1 ||
      requiredAPlus >
        totalSubjects
    ) {
      return res.status(400).send({
        success: false,
        message:
          `A+ Required Subjects must be between 1 and ${totalSubjects}`,
      });
    }

    /* =====================================================
       CALCULATION VARIABLES
    ===================================================== */

    let totalMarks = 0;
    let totalFullMarks = 0;
    let hasFailed = false;
    let aPlusCount = 0;

    const updatedSubjects = [];

    /* =====================================================
       SUBJECT LOOP
    ===================================================== */

    for (
      let index = 0;
      index < subjects.length;
      index++
    ) {
      const inputSubject =
        subjects[index];

      /* ---------------------------------------------------
         SUBJECT ID
      --------------------------------------------------- */

      let subjectId =
        inputSubject?.subjectId;

      if (
        subjectId &&
        typeof subjectId ===
          "object" &&
        subjectId.$oid
      ) {
        subjectId =
          subjectId.$oid;
      }

      /* ---------------------------------------------------
         FIND ORIGINAL SUBJECT
      --------------------------------------------------- */

      let originalSubject =
        existingResult.subjects?.find(
          (item) => {
            const existingId =
              item?.subjectId
                ?.toString();

            return (
              existingId &&
              subjectId &&
              existingId ===
                String(subjectId)
            );
          }
        );

      if (
        !originalSubject &&
        Array.isArray(
          existingResult.subjects
        )
      ) {
        originalSubject =
          existingResult.subjects[
            index
          ];
      }

      /* ---------------------------------------------------
         SUBJECT NAME
      --------------------------------------------------- */

      const subjectName =
        inputSubject?.subjectName ||
        inputSubject?.name ||
        originalSubject?.subjectName ||
        `Subject ${index + 1}`;

      /* ---------------------------------------------------
         FULL MARKS
      --------------------------------------------------- */

      let fullMarks =
        Number(
          inputSubject?.fullMarks
        );

      if (
        !Number.isFinite(
          fullMarks
        ) ||
        fullMarks <= 0
      ) {
        fullMarks =
          Number(
            originalSubject?.fullMarks
          );
      }

      if (
        !Number.isFinite(
          fullMarks
        ) ||
        fullMarks <= 0
      ) {
        return res.status(400).send({
          success: false,
          message:
            `${subjectName} has invalid full marks`,
        });
      }

      /* ---------------------------------------------------
         PASS MARKS
      --------------------------------------------------- */

      let passMarks =
        Number(
          inputSubject?.passMarks
        );

      if (
        !Number.isFinite(
          passMarks
        ) ||
        passMarks < 0
      ) {
        passMarks =
          Number(
            originalSubject?.passMarks
          );
      }

      if (
        !Number.isFinite(
          passMarks
        ) ||
        passMarks < 0
      ) {
        passMarks =
          Math.ceil(
            fullMarks * 0.33
          );
      }

      if (
        passMarks >
        fullMarks
      ) {
        return res.status(400).send({
          success: false,
          message:
            `${subjectName}: Pass marks cannot exceed ${fullMarks}`,
        });
      }

      /* ---------------------------------------------------
         OBTAINED MARKS
      --------------------------------------------------- */

      let obtainedMarks =
        Number(
          inputSubject?.obtainedMarks
        );

      if (
        !Number.isFinite(
          obtainedMarks
        )
      ) {
        obtainedMarks =
          Number(
            originalSubject?.obtainedMarks
          );
      }

      if (
        !Number.isFinite(
          obtainedMarks
        ) ||
        obtainedMarks < 0
      ) {
        return res.status(400).send({
          success: false,
          message:
            `Invalid marks for ${subjectName}`,
        });
      }

      if (
        obtainedMarks >
        fullMarks
      ) {
        return res.status(400).send({
          success: false,
          message:
            `${subjectName} marks cannot exceed ${fullMarks}`,
        });
      }

      /* ===================================================
         SUBJECT PERCENTAGE
      =================================================== */

      const percentage =
        (obtainedMarks /
          fullMarks) *
        100;

      /* ===================================================
         SUBJECT GRADE
      =================================================== */

      const grade =
        calculateGrade(
          percentage
        );

      /* ===================================================
         SUBJECT GPA
      =================================================== */

      const gradePoint =
        calculateGPA(grade);

      /* ===================================================
         SUBJECT STATUS
      =================================================== */

      const subjectStatus =
        obtainedMarks >=
        passMarks
          ? "Pass"
          : "Fail";

      if (
        subjectStatus ===
        "Fail"
      ) {
        hasFailed = true;
      }

      /* ===================================================
         A+ COUNT
      =================================================== */

      if (
        grade === "A+"
      ) {
        aPlusCount++;
      }

      /* ===================================================
         TOTAL
      =================================================== */

      totalMarks +=
        obtainedMarks;

      totalFullMarks +=
        fullMarks;

      /* ===================================================
         UPDATED SUBJECT
      =================================================== */

      updatedSubjects.push({
        subjectId:
          originalSubject?.subjectId ||
          (
            ObjectId.isValid(
              subjectId
            )
              ? new ObjectId(
                  subjectId
                )
              : subjectId
          ),

        subjectName,

        fullMarks,

        passMarks,

        obtainedMarks,

        percentage:
          Number(
            percentage.toFixed(2)
          ),

        grade,

        gradePoint,

        status:
          subjectStatus,
      });
    }

    /* =====================================================
       OVERALL PERCENTAGE
    ===================================================== */

    const overallPercentage =
      totalFullMarks > 0
        ? (totalMarks /
            totalFullMarks) *
          100
        : 0;

    /* =====================================================
       OVERALL GRADE
    ===================================================== */

    let overallGrade;

    if (
      !hasFailed &&
      aPlusCount >=
        requiredAPlus
    ) {
      overallGrade =
        "A+";
    } else {
      overallGrade =
        calculateGrade(
          overallPercentage
        );
    }

    /* =====================================================
       OVERALL GPA
    ===================================================== */

    const totalGradePoints =
      updatedSubjects.reduce(
        (
          sum,
          subject
        ) =>
          sum +
          Number(
            subject.gradePoint ||
              0
          ),
        0
      );

    let gpa =
      updatedSubjects.length >
      0
        ? totalGradePoints /
          updatedSubjects.length
        : 0;

    if (
      !hasFailed &&
      aPlusCount >=
        requiredAPlus
    ) {
      gpa = 5;
    }

    /* =====================================================
       FINAL STATUS
    ===================================================== */

    const status =
      hasFailed
        ? "Fail"
        : "Pass";

    /* =====================================================
       SESSION
    ===================================================== */

    const cleanSession =
      session !== undefined &&
      session !== null
        ? String(session).trim()
        : String(
            existingResult.session ||
              ""
          ).trim();

    /* =====================================================
       DUPLICATE CHECK
    ===================================================== */

    const duplicateResult =
      await resultsCollection.findOne({
        _id: {
          $ne:
            new ObjectId(id),
        },

        studentId:
          existingResult.studentId,

        month:
          cleanMonth,

        examName:
          cleanExamName,

        year:
          cleanYear,
      });

    if (duplicateResult) {
      return res.status(409).send({
        success: false,
        message:
          "Another result already exists for this student, month, exam and year",
      });
    }

    /* =====================================================
       STUDENT PHOTO
       Update করার সময়ও photo refresh হবে
    ===================================================== */

    const studentPhoto =
      await getStudentPhoto(
        studentsCollection,
        existingResult
      );

    /* =====================================================
       UPDATE DATA
    ===================================================== */

    const updateData = {
      month:
        cleanMonth,

      examName:
        cleanExamName,

      year:
        cleanYear,

      session:
        cleanSession,

      subjects:
        updatedSubjects,

      totalSubjects:
        updatedSubjects.length,

      aPlusRequired:
        requiredAPlus,

      aPlusCount,

      totalMarks,

      totalFullMarks,

      percentage:
        Number(
          overallPercentage.toFixed(
            2
          )
        ),

      grade:
        overallGrade,

      gpa:
        Number(
          gpa.toFixed(2)
        ),

      status,

      studentPhoto,

      updatedAt:
        new Date(),
    };

    /* =====================================================
       UPDATE DATABASE
    ===================================================== */

    const updateResult =
      await resultsCollection.updateOne(
        {
          _id:
            new ObjectId(id),
        },
        {
          $set:
            updateData,
        }
      );

    if (
      !updateResult.modifiedCount &&
      !updateResult.matchedCount
    ) {
      return res.status(404).send({
        success: false,
        message:
          "Result not found",
      });
    }

    /* =====================================================
       GET UPDATED RESULT
    ===================================================== */

    const updatedResult =
      await resultsCollection.findOne({
        _id:
          new ObjectId(id),
      });

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.send({
      success: true,

      message:
        "Result updated successfully",

      result:
        updatedResult,
    });
  } catch (error) {
    console.error(
      "Update Result Error:",
      error
    );

    return res.status(500).send({
      success: false,
      message:
        error.message ||
        "Failed to update result",
    });
  }
};

/* =========================================================
   DELETE RESULT
========================================================= */

const deleteResult = async (
  req,
  res
) => {
  try {
    const db = getDB();

    const resultsCollection =
      db.collection("results");

    const { id } =
      req.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).send({
        success: false,
        message:
          "Invalid result ID",
      });
    }

    const result =
      await resultsCollection.deleteOne({
        _id:
          new ObjectId(id),
      });

    if (
      !result.deletedCount
    ) {
      return res.status(404).send({
        success: false,
        message:
          "Result not found",
      });
    }

    return res.send({
      success: true,
      message:
        "Result deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete result error:",
      error
    );

    return res.status(500).send({
      success: false,
      message:
        "Failed to delete result",
    });
  }
};

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  addResult,
  getResults,
  getResultById,
  updateResult,
  deleteResult,
};