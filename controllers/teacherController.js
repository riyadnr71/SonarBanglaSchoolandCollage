
const { ObjectId } = require("mongodb");
const crypto = require("crypto");
const cloudinary = require("../config/cloudinary");

const { getDB } = require("../config/db");

/* =========================================================
   UPLOAD BUFFER TO CLOUDINARY
========================================================= */

const uploadToCloudinary = (
  buffer,
  folder = "madrasa/teachers"
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
            return;
          }

          resolve(result);
        }
      );

    uploadStream.end(buffer);
  });
};

/* =========================================================
   DELETE CLOUDINARY IMAGE
========================================================= */

const deleteCloudinaryImage = async (
  publicId
) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: "image",
      }
    );
  } catch (error) {
    console.error(
      "❌ Cloudinary delete error:",
      error?.message || error
    );
  }
};

/* =========================================================
   GENERATE TEACHER ID
========================================================= */

const generateTeacherId = async (db) => {
  const teachers = await db
    .collection("teachers")
    .find(
      {
        teacherId: {
          $exists: true,
        },
      },
      {
        projection: {
          teacherId: 1,
        },
      }
    )
    .toArray();

  let maxNumber = 0;

  for (const teacher of teachers) {
    const match = String(
      teacher.teacherId || ""
    ).match(/T-(\d+)/i);

    if (match) {
      const number = parseInt(
        match[1],
        10
      );

      if (!Number.isNaN(number)) {
        maxNumber = Math.max(
          maxNumber,
          number
        );
      }
    }
  }

  return `T-${String(
    maxNumber + 1
  ).padStart(4, "0")}`;
};

/* =========================================================
   GENERATE QR TOKEN
========================================================= */

const generateQrToken = () => {
  return crypto
    .randomBytes(32)
    .toString("hex");
};

/* =========================================================
   ADD TEACHER
========================================================= */

const addTeacher = async (
  req,
  res
) => {
  try {
    const {
      name,
      mobile = "",
      email = "",
      branch = "Main Branch",
      subject = "",
      designation = "",
      qualification = "",
      salary = "",
      joiningDate = "",
      address = "",
      status = "Active",
      note = "",
    } = req.body || {};

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (
      !name ||
      !String(name).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Teacher name is required.",
      });
    }

    const db = getDB();

    /* =====================================================
       CLEAN BASIC DATA
    ===================================================== */

    const cleanName =
      String(name).trim();

    const cleanMobile =
      String(
        mobile || ""
      ).trim();

    const cleanEmail =
      String(
        email || ""
      ).trim();

    const cleanBranch =
      String(
        branch || "Main Branch"
      ).trim();

    /* =====================================================
       MOBILE DUPLICATE CHECK
    ===================================================== */

    if (cleanMobile) {
      const existingMobile =
        await db
          .collection("teachers")
          .findOne({
            mobile:
              cleanMobile,
          });

      if (existingMobile) {
        return res.status(409).json({
          success: false,
          message:
            "This mobile number is already registered.",
        });
      }
    }

    /* =====================================================
       EMAIL DUPLICATE CHECK
    ===================================================== */

    if (cleanEmail) {
      const existingEmail =
        await db
          .collection("teachers")
          .findOne({
            email:
              cleanEmail,
          });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message:
            "This email is already registered.",
        });
      }
    }

    /* =====================================================
       GENERATE TEACHER ID
    ===================================================== */

    const teacherId =
      await generateTeacherId(
        db
      );

    /* =====================================================
       GENERATE QR TOKEN
    ===================================================== */

    const qrToken =
      generateQrToken();

    /* =====================================================
       NORMALIZE STATUS
    ===================================================== */

    const normalizedStatus =
      String(status).toLowerCase() ===
      "inactive"
        ? "inactive"
        : "active";

    /* =====================================================
       NORMALIZE SALARY
    ===================================================== */

    let normalizedSalary = "";

    if (
      salary !== undefined &&
      salary !== null &&
      String(salary).trim() !== ""
    ) {
      const numericSalary =
        Number(salary);

      normalizedSalary =
        Number.isNaN(
          numericSalary
        )
          ? ""
          : numericSalary;
    }

    /* =====================================================
       CLOUDINARY IMAGE UPLOAD
    ===================================================== */

    let image = "";
    let imagePublicId = "";

    if (
      req.file &&
      req.file.buffer
    ) {
      const uploadedImage =
        await uploadToCloudinary(
          req.file.buffer,
          "madrasa/teachers"
        );

      image =
        uploadedImage.secure_url ||
        uploadedImage.url ||
        "";

      imagePublicId =
        uploadedImage.public_id ||
        "";
    }

    /* =====================================================
       CREATE TEACHER
    ===================================================== */

    const now =
      new Date();

    const teacher = {
      teacherId,

      qrToken,

      name:
        cleanName,

      mobile:
        cleanMobile,

      email:
        cleanEmail,

      branch:
        cleanBranch,

      subject:
        String(
          subject || ""
        ).trim(),

      designation:
        String(
          designation || ""
        ).trim(),

      qualification:
        String(
          qualification || ""
        ).trim(),

      salary:
        normalizedSalary,

      joiningDate:
        String(
          joiningDate || ""
        ).trim(),

      address:
        String(
          address || ""
        ).trim(),

      status:
        normalizedStatus,

      note:
        String(
          note || ""
        ).trim(),

      image,

      imagePublicId,

      createdAt:
        now,

      updatedAt:
        now,
    };

    /* =====================================================
       INSERT TEACHER
    ===================================================== */

    const result =
      await db
        .collection("teachers")
        .insertOne(
          teacher
        );

    if (
      !result.insertedId
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Teacher could not be created.",
      });
    }

    /* =====================================================
       GET CREATED TEACHER
    ===================================================== */

    const createdTeacher =
      await db
        .collection("teachers")
        .findOne({
          _id:
            result.insertedId,
        });

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(201).json({
      success: true,

      message:
        "Teacher created successfully.",

      teacher:
        createdTeacher,
    });
  } catch (error) {
    console.error(
      "❌ addTeacher error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to create teacher.",
    });
  }
};

/* =========================================================
   GET ALL TEACHERS
========================================================= */

const getTeachers = async (
  req,
  res
) => {
  try {
    const db =
      getDB();

    const teachers =
      await db
        .collection("teachers")
        .find({})
        .sort({
          createdAt: -1,
        })
        .toArray();

    return res.status(200).json({
      success: true,
      teachers,
    });
  } catch (error) {
    console.error(
      "❌ getTeachers error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load teachers.",
    });
  }
};

/* =========================================================
   GET SINGLE TEACHER
========================================================= */

const getTeacherById = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid teacher ID.",
      });
    }

    const db =
      getDB();

    const teacher =
      await db
        .collection("teachers")
        .findOne({
          _id:
            new ObjectId(id),
        });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message:
          "Teacher not found.",
      });
    }

    return res.status(200).json({
      success: true,
      teacher,
    });
  } catch (error) {
    console.error(
      "❌ getTeacherById error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load teacher.",
    });
  }
};

/* =========================================================
   UPDATE TEACHER
========================================================= */

const updateTeacher = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid teacher ID.",
      });
    }

    const {
      name,
      mobile,
      email,
      branch,
      subject,
      designation,
      qualification,
      salary,
      joiningDate,
      address,
      status,
      note,
    } = req.body || {};

    const db =
      getDB();

    const teacherObjectId =
      new ObjectId(id);

    /* =====================================================
       FIND TEACHER
    ===================================================== */

    const teacher =
      await db
        .collection("teachers")
        .findOne({
          _id:
            teacherObjectId,
        });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message:
          "Teacher not found.",
      });
    }

    const updateData = {
      updatedAt:
        new Date(),
    };

    /* =====================================================
       NAME
    ===================================================== */

    if (
      name !== undefined
    ) {
      const cleanName =
        String(name).trim();

      if (!cleanName) {
        return res.status(400).json({
          success: false,
          message:
            "Teacher name cannot be empty.",
        });
      }

      updateData.name =
        cleanName;
    }

    /* =====================================================
       MOBILE
    ===================================================== */

    if (
      mobile !== undefined
    ) {
      const cleanMobile =
        String(mobile).trim();

      if (
        cleanMobile &&
        cleanMobile !==
          String(
            teacher.mobile || ""
          )
      ) {
        const duplicate =
          await db
            .collection("teachers")
            .findOne({
              mobile:
                cleanMobile,

              _id: {
                $ne:
                  teacherObjectId,
              },
            });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message:
              "This mobile number is already registered.",
          });
        }
      }

      updateData.mobile =
        cleanMobile;
    }

    /* =====================================================
       EMAIL
    ===================================================== */

    if (
      email !== undefined
    ) {
      const cleanEmail =
        String(email).trim();

      if (
        cleanEmail &&
        cleanEmail !==
          String(
            teacher.email || ""
          )
      ) {
        const duplicate =
          await db
            .collection("teachers")
            .findOne({
              email:
                cleanEmail,

              _id: {
                $ne:
                  teacherObjectId,
              },
            });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message:
              "This email is already registered.",
          });
        }
      }

      updateData.email =
        cleanEmail;
    }

    /* =====================================================
       BRANCH
    ===================================================== */

    if (
      branch !== undefined
    ) {
      updateData.branch =
        String(
          branch || ""
        ).trim();
    }

    /* =====================================================
       SUBJECT
    ===================================================== */

    if (
      subject !== undefined
    ) {
      updateData.subject =
        String(
          subject || ""
        ).trim();
    }

    /* =====================================================
       DESIGNATION
    ===================================================== */

    if (
      designation !==
      undefined
    ) {
      updateData.designation =
        String(
          designation || ""
        ).trim();
    }

    /* =====================================================
       QUALIFICATION
    ===================================================== */

    if (
      qualification !==
      undefined
    ) {
      updateData.qualification =
        String(
          qualification || ""
        ).trim();
    }

    /* =====================================================
       SALARY
    ===================================================== */

    if (
      salary !== undefined
    ) {
      if (
        String(
          salary
        ).trim() === ""
      ) {
        updateData.salary =
          "";
      } else {
        const numericSalary =
          Number(salary);

        updateData.salary =
          Number.isNaN(
            numericSalary
          )
            ? ""
            : numericSalary;
      }
    }

    /* =====================================================
       JOINING DATE
    ===================================================== */

    if (
      joiningDate !==
      undefined
    ) {
      updateData.joiningDate =
        String(
          joiningDate || ""
        ).trim();
    }

    /* =====================================================
       ADDRESS
    ===================================================== */

    if (
      address !== undefined
    ) {
      updateData.address =
        String(
          address || ""
        ).trim();
    }

    /* =====================================================
       NOTE
    ===================================================== */

    if (
      note !== undefined
    ) {
      updateData.note =
        String(
          note || ""
        ).trim();
    }

    /* =====================================================
       STATUS
    ===================================================== */

    if (
      status !== undefined
    ) {
      updateData.status =
        String(status)
          .toLowerCase() ===
        "inactive"
          ? "inactive"
          : "active";
    }

    /* =====================================================
       NEW IMAGE UPLOAD
    ===================================================== */

    if (
      req.file &&
      req.file.buffer
    ) {
      const uploadedImage =
        await uploadToCloudinary(
          req.file.buffer,
          "madrasa/teachers"
        );

      const newImage =
        uploadedImage.secure_url ||
        uploadedImage.url ||
        "";

      const newImagePublicId =
        uploadedImage.public_id ||
        "";

      /* -----------------------------------------------
         DELETE OLD IMAGE
      ------------------------------------------------ */

      if (
        teacher.imagePublicId
      ) {
        await deleteCloudinaryImage(
          teacher.imagePublicId
        );
      }

      updateData.image =
        newImage;

      updateData.imagePublicId =
        newImagePublicId;
    }

    /* =====================================================
       UPDATE DATABASE
    ===================================================== */

    const result =
      await db
        .collection("teachers")
        .updateOne(
          {
            _id:
              teacherObjectId,
          },
          {
            $set:
              updateData,
          }
        );

    if (
      !result.matchedCount
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Teacher not found.",
      });
    }

    /* =====================================================
       GET UPDATED TEACHER
    ===================================================== */

    const updatedTeacher =
      await db
        .collection("teachers")
        .findOne({
          _id:
            teacherObjectId,
        });

    return res.status(200).json({
      success: true,

      message:
        "Teacher updated successfully.",

      teacher:
        updatedTeacher,
    });
  } catch (error) {
    console.error(
      "❌ updateTeacher error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to update teacher.",
    });
  }
};

/* =========================================================
   REGENERATE TEACHER QR TOKEN
========================================================= */

const regenerateTeacherQr = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid teacher ID.",
      });
    }

    const db =
      getDB();

    const teacherObjectId =
      new ObjectId(id);

    const teacher =
      await db
        .collection("teachers")
        .findOne({
          _id:
            teacherObjectId,
        });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message:
          "Teacher not found.",
      });
    }

    const qrToken =
      generateQrToken();

    await db
      .collection("teachers")
      .updateOne(
        {
          _id:
            teacherObjectId,
        },
        {
          $set: {
            qrToken,

            updatedAt:
              new Date(),
          },
        }
      );

    const updatedTeacher =
      await db
        .collection("teachers")
        .findOne({
          _id:
            teacherObjectId,
        });

    return res.status(200).json({
      success: true,

      message:
        "Teacher QR regenerated successfully.",

      teacher:
        updatedTeacher,
    });
  } catch (error) {
    console.error(
      "❌ regenerateTeacherQr error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to regenerate teacher QR.",
    });
  }
};

/* =========================================================
   GENERATE QR FOR OLD TEACHER
========================================================= */

const generateMissingTeacherQr =
  async (
    req,
    res
  ) => {
    try {
      const { id } =
        req.params;

      if (
        !ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid teacher ID.",
        });
      }

      const db =
        getDB();

      const teacherObjectId =
        new ObjectId(id);

      const teacher =
        await db
          .collection("teachers")
          .findOne({
            _id:
              teacherObjectId,
          });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          message:
            "Teacher not found.",
        });
      }

      /* -------------------------------------------------
         ALREADY HAS QR
      ------------------------------------------------- */

      if (teacher.qrToken) {
        return res.status(200).json({
          success: true,

          alreadyExists:
            true,

          message:
            "Teacher QR token already exists.",

          teacher,
        });
      }

      /* -------------------------------------------------
         CREATE TOKEN
      ------------------------------------------------- */

      const qrToken =
        generateQrToken();

      await db
        .collection("teachers")
        .updateOne(
          {
            _id:
              teacherObjectId,
          },
          {
            $set: {
              qrToken,

              updatedAt:
                new Date(),
            },
          }
        );

      const updatedTeacher =
        await db
          .collection("teachers")
          .findOne({
            _id:
              teacherObjectId,
          });

      return res.status(200).json({
        success: true,

        message:
          "Teacher QR token generated successfully.",

        teacher:
          updatedTeacher,
      });
    } catch (error) {
      console.error(
        "❌ generateMissingTeacherQr error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to generate teacher QR token.",
      });
    }
  };

/* =========================================================
   DELETE TEACHER
========================================================= */

const deleteTeacher = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (
      !ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid teacher ID.",
      });
    }

    const db =
      getDB();

    const teacherObjectId =
      new ObjectId(id);

    const teacher =
      await db
        .collection("teachers")
        .findOne({
          _id:
            teacherObjectId,
        });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message:
          "Teacher not found.",
      });
    }

    /* =====================================================
       DELETE CLOUDINARY IMAGE
    ===================================================== */

    if (
      teacher.imagePublicId
    ) {
      await deleteCloudinaryImage(
        teacher.imagePublicId
      );
    }

    /* =====================================================
       DELETE TEACHER
    ===================================================== */

    const result =
      await db
        .collection("teachers")
        .deleteOne({
          _id:
            teacherObjectId,
        });

    if (
      !result.deletedCount
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Teacher not found.",
      });
    }

    return res.status(200).json({
      success: true,

      message:
        "Teacher deleted successfully.",
    });
  } catch (error) {
    console.error(
      "❌ deleteTeacher error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to delete teacher.",
    });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  addTeacher,
  getTeachers,
  getTeacherById,
  updateTeacher,
  regenerateTeacherQr,
  generateMissingTeacherQr,
  deleteTeacher,
};

