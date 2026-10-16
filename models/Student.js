const StudentModel = {
  name: "",
  idCard: "",
  roll: "",

  className: "",
  section: "",
  session: "",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  religion: "",
  nationality: "Bangladeshi",

  fatherName: "",
  fatherMobile: "",
  motherName: "",
  motherMobile: "",
  guardianName: "",
  guardianMobile: "",
  guardianRelation: "",

  presentAddress: "",
  permanentAddress: "",

  admissionDate: "",
  previousInstitution: "",
  previousClass: "",

  status: "Active",

  image: null,
  imagePublicId: null,
  passwordHash: null,
  qrCode: null,

  createdAt: new Date(),
  updatedAt: new Date(),
};

module.exports = StudentModel;