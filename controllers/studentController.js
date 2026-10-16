const { ObjectId } = require("mongodb");
const { Readable } = require("stream");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");

const { getDB } = require("../config/db");
const cloudinary = require("../config/cloudinary");

/* =========================================================
   CONSTANTS
========================================================= */



const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

/* =========================================================
   CLOUDINARY UPLOAD
========================================================= */

const uploadToCloudinary = (
  fileBuffer,
  folder = "madrasa/students"
) => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

    Readable.from(fileBuffer).pipe(
      uploadStream
    );
  });
};

/* =========================================================
   GENERATE STUDENT PASSWORD
========================================================= */

const generateStudentPassword = () => {
  const randomNumber = Math.floor(
    100000 + Math.random() * 900000
  );

  return `NR${randomNumber}`;
};

/* =========================================================
   GENERATE STUDENT QR
========================================================= */

const generateStudentQR = async (
  studentId
) => {
  const studentPortalUrl =
    `${FRONTEND_URL.replace(/\/$/, "")}/student/${studentId}`;

  return await QRCode.toDataURL(
    studentPortalUrl,
    {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 500,
    }
  );
};




/* =========================================================
   ADD STUDENT
========================================================= */

const addStudent = async (req, res) => {
  try {
    const db = getDB();

    const {
      name,
      idCard,
      roll,
     
      className,
      section,
      session,
      dateOfBirth,
      gender,
      bloodGroup,
      religion,
      nationality,
      fatherName,
      fatherMobile,
      motherName,
      motherMobile,
      guardianName,
      guardianMobile,
      guardianRelation,
      presentAddress,
      permanentAddress,
      admissionDate,
      previousInstitution,
      previousClass,
      status,
    } = req.body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Student name is required.",
      });
    }

    if (!idCard?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Student ID/Card is required.",
      });
    }

    if (!className?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Class is required.",
      });
    }

 

    /* =====================================================
       CHECK DUPLICATE STUDENT ID
    ===================================================== */

    const existingStudent =
      await db.collection("students").findOne({
        idCard: String(idCard).trim(),
      });

    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message:
          "A student with this ID/Card already exists.",
      });
    }

    /* =====================================================
       IMAGE UPLOAD
    ===================================================== */

    let image = null;
    let imagePublicId = null;

    if (req.file) {
      const uploaded =
        await uploadToCloudinary(
          req.file.buffer
        );

      image = uploaded.secure_url;
      imagePublicId = uploaded.public_id;
    }

    /* =====================================================
       GENERATE PASSWORD
    ===================================================== */

    const plainPassword =
      generateStudentPassword();

    const passwordHash =
      await bcrypt.hash(
        plainPassword,
        10
      );

    /* =====================================================
       CREATE STUDENT ID FIRST
    ===================================================== */

    const studentObjectId =
      new ObjectId();

    /* =====================================================
       GENERATE QR
    ===================================================== */

    const qrCode =
      await generateStudentQR(
        studentObjectId.toString()
      );

    /* =====================================================
       STUDENT DATA
    ===================================================== */

    const student = {
      _id: studentObjectId,

      name: name.trim(),

      idCard: String(idCard).trim(),

      roll: roll
        ? String(roll).trim()
        : "",

     

      className: className.trim(),

      section: section
        ? section.trim()
        : "",

      session: session
        ? session.trim()
        : "",

      dateOfBirth:
        dateOfBirth || "",

      gender:
        gender || "",

      bloodGroup:
        bloodGroup || "",

      religion:
        religion || "",

      nationality:
        nationality?.trim() ||
        "Bangladeshi",

      fatherName:
        fatherName?.trim() || "",

      fatherMobile:
        fatherMobile?.trim() || "",

      motherName:
        motherName?.trim() || "",

      motherMobile:
        motherMobile?.trim() || "",

      guardianName:
        guardianName?.trim() || "",

      guardianMobile:
        guardianMobile?.trim() || "",

      guardianRelation:
        guardianRelation?.trim() || "",

      presentAddress:
        presentAddress?.trim() || "",

      permanentAddress:
        permanentAddress?.trim() || "",

      admissionDate:
        admissionDate || "",

      previousInstitution:
        previousInstitution?.trim() ||
        "",

      previousClass:
        previousClass?.trim() || "",

      status:
        status || "Active",

      image,

      imagePublicId,

      passwordHash,

      qrCode,

      createdAt: new Date(),

      updatedAt: new Date(),
    };

    /* =====================================================
       INSERT
    ===================================================== */

    await db
      .collection("students")
      .insertOne(student);

    /* =====================================================
       RESPONSE
    ===================================================== */

    const {
      passwordHash: removedPassword,
      ...studentResponse
    } = student;

    return res.status(201).json({
      success: true,

      message:
        "Student added successfully.",

      student: studentResponse,

      generatedPassword:
        plainPassword,
    });
  } catch (error) {
    console.error(
      "Add Student Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to add student.",
    });
  }
};

/* =========================================================
   GET ALL STUDENTS
========================================================= */

const getStudents = async (req, res) => {
  try {
    const db = getDB();

    const students =
      await db
        .collection("students")
        .find({})
        .sort({
          createdAt: -1,
        })
        .toArray();

    const safeStudents =
      students.map((student) => {
        const {
          passwordHash,
          ...safeStudent
        } = student;

        return safeStudent;
      });

    return res.status(200).json({
      success: true,
      students: safeStudents,
    });
  } catch (error) {
    console.error(
      "Get Students Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load students.",
    });
  }
};

/* =========================================================
   GET STUDENT BY ID
========================================================= */

const getStudentById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    const db = getDB();

    const student =
      await db
        .collection("students")
        .findOne({
          _id: new ObjectId(id),
        });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const {
      passwordHash,
      ...studentResponse
    } = student;

    return res.status(200).json({
      success: true,
      student: studentResponse,
    });
  } catch (error) {
    console.error(
      "Get Student Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load student.",
    });
  }
};

/* =========================================================
   UPDATE STUDENT
========================================================= */

const updateStudent = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    const db = getDB();

    const existingStudent =
      await db
        .collection("students")
        .findOne({
          _id: new ObjectId(id),
        });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const {
      name,
      idCard,
      roll,
    
      className,
      section,
      session,
      dateOfBirth,
      gender,
      bloodGroup,
      religion,
      nationality,
      fatherName,
      fatherMobile,
      motherName,
      motherMobile,
      guardianName,
      guardianMobile,
      guardianRelation,
      presentAddress,
      permanentAddress,
      admissionDate,
      previousInstitution,
      previousClass,
      status,
    } = req.body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Student name is required.",
      });
    }

    if (!idCard?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Student ID/Card is required.",
      });
    }

    if (!className?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Class is required.",
      });
    }



    /* =====================================================
       CHECK DUPLICATE ID
    ===================================================== */

    const duplicateStudent =
      await db
        .collection("students")
        .findOne({
          idCard: String(idCard).trim(),
          _id: {
            $ne: new ObjectId(id),
          },
        });

    if (duplicateStudent) {
      return res.status(409).json({
        success: false,
        message:
          "Another student already uses this ID/Card.",
      });
    }

    /* =====================================================
       IMAGE
    ===================================================== */

    let image =
      existingStudent.image || null;

    let imagePublicId =
      existingStudent.imagePublicId ||
      null;

    if (req.file) {
      const uploaded =
        await uploadToCloudinary(
          req.file.buffer
        );

      image = uploaded.secure_url;
      imagePublicId =
        uploaded.public_id;

      /* ================================================
         DELETE OLD CLOUDINARY IMAGE
      ================================================ */

      if (
        existingStudent.imagePublicId
      ) {
        try {
          await cloudinary.uploader.destroy(
            existingStudent.imagePublicId
          );
        } catch (cloudinaryError) {
          console.error(
            "Old Image Delete Error:",
            cloudinaryError
          );
        }
      }
    }

    /* =====================================================
       UPDATE DATA
    ===================================================== */

    const updateData = {
      name: name.trim(),

      idCard: String(idCard).trim(),

      roll: roll
        ? String(roll).trim()
        : "",

      

      className: className.trim(),

      section: section
        ? section.trim()
        : "",

      session: session
        ? session.trim()
        : "",

      dateOfBirth:
        dateOfBirth || "",

      gender:
        gender || "",

      bloodGroup:
        bloodGroup || "",

      religion:
        religion || "",

      nationality:
        nationality?.trim() ||
        "Bangladeshi",

      fatherName:
        fatherName?.trim() || "",

      fatherMobile:
        fatherMobile?.trim() || "",

      motherName:
        motherName?.trim() || "",

      motherMobile:
        motherMobile?.trim() || "",

      guardianName:
        guardianName?.trim() || "",

      guardianMobile:
        guardianMobile?.trim() || "",

      guardianRelation:
        guardianRelation?.trim() || "",

      presentAddress:
        presentAddress?.trim() || "",

      permanentAddress:
        permanentAddress?.trim() || "",

      admissionDate:
        admissionDate || "",

      previousInstitution:
        previousInstitution?.trim() ||
        "",

      previousClass:
        previousClass?.trim() || "",

      status:
        status || "Active",

      image,

      imagePublicId,

      updatedAt: new Date(),
    };

    /* =====================================================
       UPDATE
    ===================================================== */

    await db
      .collection("students")
      .updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: updateData,
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "Student updated successfully.",
    });
  } catch (error) {
    console.error(
      "Update Student Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update student.",
    });
  }
};

/* =========================================================
   RESET STUDENT PASSWORD
========================================================= */

const resetStudentPassword = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    const db = getDB();

    const student =
      await db
        .collection("students")
        .findOne({
          _id: new ObjectId(id),
        });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const plainPassword =
      generateStudentPassword();

    const passwordHash =
      await bcrypt.hash(
        plainPassword,
        10
      );

    await db
      .collection("students")
      .updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            passwordHash,
            updatedAt: new Date(),
          },
        }
      );

    return res.status(200).json({
      success: true,

      message:
        "Student password reset successfully.",

      password:
        plainPassword,
    });
  } catch (error) {
    console.error(
      "Reset Student Password Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to reset student password.",
    });
  }
};

/* =========================================================
   REGENERATE STUDENT QR
========================================================= */

const regenerateStudentQR = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    const db = getDB();

    const student =
      await db
        .collection("students")
        .findOne({
          _id: new ObjectId(id),
        });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const qrCode =
      await generateStudentQR(id);

    await db
      .collection("students")
      .updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            qrCode,
            updatedAt: new Date(),
          },
        }
      );

    return res.status(200).json({
      success: true,

      message:
        "Student QR code regenerated successfully.",

      qrCode,
    });
  } catch (error) {
    console.error(
      "Regenerate Student QR Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to regenerate student QR.",
    });
  }
};

/* =========================================================
   DELETE STUDENT
========================================================= */

const deleteStudent = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    const db = getDB();

    const student =
      await db
        .collection("students")
        .findOne({
          _id: new ObjectId(id),
        });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    /* =====================================================
       DELETE CLOUDINARY IMAGE
    ===================================================== */

    if (student.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(
          student.imagePublicId
        );
      } catch (cloudinaryError) {
        console.error(
          "Cloudinary Delete Error:",
          cloudinaryError
        );
      }
    }

    /* =====================================================
       DELETE STUDENT
    ===================================================== */

    await db
      .collection("students")
      .deleteOne({
        _id: new ObjectId(id),
      });

    return res.status(200).json({
      success: true,
      message:
        "Student deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete Student Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete student.",
    });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  addStudent,
  getStudents,
  getStudentById,
  updateStudent,
  resetStudentPassword,
  regenerateStudentQR,
  deleteStudent,
};