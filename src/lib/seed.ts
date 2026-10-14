// One-time Cloud Firestore seeding module. Writes a complete demo dataset into
// Firestore on first launch, gated by a marker doc in the _meta collection.
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { provisionDemoStudent } from "./demoStudentSeed";
import { todayStr } from "./hostelService";

const SEED_META_DOC = "seed_state";
const UPGRADE_META_DOC = "seed_state_v2";

function buildSeedData() {
  const todayStr = new Date().toISOString().split("T")[0];

  const hostels = [
    {
      id: "h_1",
      name: "APJ Abdul Kalam Boys Hostel (BH-1)",
      type: "Boys",
      capacity: 350,
      occupied: 310,
      facilities: ["Wi-Fi 6", "Mess & Dining", "Study Hall", "Gymnasium", "Indoor Games", "Solar Hot Water", "24/7 Security"],
      mess_available: true,
      study_rooms: true,
      wifi: true,
      security: true,
      laundry: true,
      recreation: true,
      medical_support: true,
      status: "normal",
    },
    {
      id: "h_2",
      name: "CV Raman Boys Hostel (BH-2)",
      type: "Boys",
      capacity: 300,
      occupied: 265,
      facilities: ["Wi-Fi 6", "Mess & Dining", "Study Room", "Basketball Court", "Solar Water", "24/7 CCTV"],
      mess_available: true,
      study_rooms: true,
      wifi: true,
      security: true,
      laundry: true,
      recreation: true,
      medical_support: true,
      status: "normal",
    },
    {
      id: "h_3",
      name: "Kalpana Chawla Girls Hostel (GH-1)",
      type: "Girls",
      capacity: 400,
      occupied: 378,
      facilities: ["High Security", "Wi-Fi", "Dedicated Mess", "Fitness Center", "Reading Room", "Biometric Gate", "Doctor-on-call"],
      mess_available: true,
      study_rooms: true,
      wifi: true,
      security: true,
      laundry: true,
      recreation: true,
      medical_support: true,
      status: "normal",
    },
  ];

  const rooms: any[] = [];
  const hostelNames = ["APJ Abdul Kalam Boys Hostel (BH-1)", "CV Raman Boys Hostel (BH-2)", "Kalpana Chawla Girls Hostel (GH-1)"];
  const blocks = ["Block A", "Block B"];
  let rCount = 101;
  hostelNames.forEach((hName) => {
    blocks.forEach((blk) => {
      [1, 2, 3].forEach((flr) => {
        for (let i = 1; i <= 6; i++) {
          const rNum = `${flr}0${i}`;
          rooms.push({
            id: `rm_${rCount++}`,
            hostel: hName,
            block: blk,
            floor: flr,
            room_number: rNum,
            capacity: 3,
            occupied: i === 6 ? 0 : i % 2 === 0 ? 2 : 3,
            status: i === 6 ? "vacant" : i === 5 ? "maintenance" : "occupied",
            condition: i === 5 ? "needs_repair" : i % 4 === 0 ? "excellent" : "good",
          });
        }
      });
    });
  });

  const firstNames = ["Aarav", "Ananya", "Rohan", "Sai", "Kavya", "Venkatesh", "Lakshmi", "Rahul", "Priya", "Manish", "Divya", "Srinivas", "Meghana", "Karthik", "Sneha", "Prashanth", "Harini", "Pavan", "Deepika", "Vamsi"];
  const lastNames = ["Reddy", "Chowdhary", "Sharma", "Rao", "Naidu", "Verma", "Teja", "Gupta", "Kaur", "Kumar", "Singh", "Yadav", "Joshi", "Babu", "Goud"];
  const branches = ["Computer Science (CSE)", "Electronics & Comm (ECE)", "Electrical & Electronics (EEE)", "Mechanical Eng (ME)", "Civil Eng (CE)", "AI & Data Science (AIDS)"];

  const students: any[] = [];
  for (let i = 1; i <= 105; i++) {
    const student_id = `22091A${0 + String(i).padStart(3, "0")}`;
    // The demo student (used for employee-demo logins & parent linking) is
    // hard-coded as Rohan Sharma so every module references a consistent person.
    const fname = student_id === "22091A003" ? "Rohan" : firstNames[i % firstNames.length];
    const lname = student_id === "22091A003" ? "Sharma" : lastNames[(i * 3) % lastNames.length];
    const isGirl = ["Ananya", "Kavya", "Lakshmi", "Priya", "Divya", "Meghana", "Sneha", "Harini", "Deepika"].includes(fname);
    const hName = isGirl ? hostelNames[2] : i % 2 === 0 ? hostelNames[0] : hostelNames[1];
    const blk = i % 2 === 0 ? "Block A" : "Block B";
    const flr = (i % 3) + 1;
    const rNum = student_id === "22091A003" ? "105" : `${flr}0${(i % 5) + 1}`;
    const yearNum = ((i % 4) + 1).toString();

    let statusVal = "present";
    if (i % 11 === 0) statusVal = "outside";
    else if (i % 17 === 0) statusVal = "leave";
    else if (i % 23 === 0) statusVal = "late";

    students.push({
      id: `std_${i}`,
      student_id,
      name: `${fname} ${lname}`,
      email: `${fname.toLowerCase()}.${lname.toLowerCase()}@rgmcet.edu.in`,
      branch: branches[i % branches.length],
      year: `${yearNum}${yearNum === "1" ? "st" : yearNum === "2" ? "nd" : yearNum === "3" ? "rd" : "th"} Year`,
      mobile: `+91 98765 ${String(10000 + i).slice(1)}`,
      hostel: hName,
      block: blk,
      floor: flr,
      room: rNum,
      bed: `Bed ${(i % 3) + 1}`,
      status: statusVal,
      photo_url: `https://images.unsplash.com/photo-${1534528741775 + i * 100}?w=150&auto=format&fit=crop&q=80`,
      parent_name: `Mr. ${lname} Senior`,
      parent_phone: `+91 94400 ${String(20000 + i).slice(1)}`,
    });
  }

  const menus = [
    {
      id: "menu_1",
      date: todayStr,
      hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
      breakfast: ["Idli & Medu Vada", "Sambar & Coconut Chutney", "Bread Jam & Butter", "Tea / Coffee / Milk"],
      lunch: ["Steamed Rice", "Andhra Style Pappu", "Paneer Butter Masala", "Rasam & Curd", "Appalam"],
      snacks: ["Samosa / Onion Pakoda", "Hot Masala Chai", "Biscuits"],
      dinner: ["Chapati / Phulka", "Dal Tadka", "Veg Biryani & Raita", "Gulab Jamun", "Milk"],
      special: "Special Paneer Biryani & Gulab Jamun for Festival",
      festival: "Ugadi Celebration",
      is_special: true,
      is_veg: true,
      updated_at: new Date().toISOString(),
    },
  ];

  // ---------- Meal Booking seed (v3) ----------
  // Extra daily menus (tomorrow + next 2 days) for BH-1 and GH-1 so students
  // can try the advance meal-booking + menu-item selection feature immediately.
  const bookingMenus = (() => {
    const rows: any[] = [];
    const hostels = [
      "APJ Abdul Kalam Boys Hostel (BH-1)",
      "CV Raman Boys Hostel (BH-2)",
      "Kalpana Chawla Girls Hostel (GH-1)",
    ];
    const specialDays = [
      { breakfast: ["Upma", "Bread with Butter and Jam"], lunch: ["Veg Biryani", "Lemon Rice"], dinner: ["Chapati with Curry", "Fried Rice"] },
      { breakfast: ["Idli & Sambar", "Dosa with Chutney"], lunch: ["Steamed Rice with Dal", "Curd Rice"], dinner: ["Paneer Roti", "Veg Pulao"] },
      { breakfast: ["Pongal", "Mysore Bonda"], lunch: ["Veg Fried Rice", "Tomato Rice"], dinner: ["Chole Bhature", "Jeera Rice"] },
    ];
    let idx = 0;
    for (let ahead = 1; ahead <= 3; ahead++) {
      const base = new Date(todayStr);
      base.setDate(base.getDate() + ahead);
      const date = base.toISOString().split("T")[0];
      const sp = specialDays[idx % specialDays.length];
      idx++;
      hostels.forEach((hostel, h) => {
        rows.push({
          id: `menu_bk_${ahead}_${h}`,
          date,
          hostel,
          breakfast: sp.breakfast,
          lunch: sp.lunch,
          snacks: ["Masala Chai", "Banana", "Biscuits"],
          dinner: sp.dinner,
          special: "",
          festival: "",
          is_special: ahead % 2 === 0,
          is_veg: true,
          updated_at: new Date().toISOString(),
        });
      });
    }
    return rows;
  })();

  // ---------- Meal Booking sample records ----------
  // Demonstrate item-wise analytics. A handful of students book the next day's
  // meals with distinct menu items so the analytics bars show real counts.
  const mealBookings = (() => {
    const rows: any[] = [];
    const tomorrow = new Date(todayStr);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmr = tomorrow.toISOString().split("T")[0];
    const now = new Date().toISOString();
    const sample = [
      { id: "mbk_1", sid: "22091A001", name: "Aarav Reddy", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", room: "101", meal: "breakfast", item: "Upma" },
      { id: "mbk_2", sid: "22091A002", name: "Ananya Chowdhary", hostel: "Kalpana Chawla Girls Hostel (GH-1)", room: "203", meal: "breakfast", item: "Bread with Butter and Jam" },
      { id: "mbk_3", sid: "22091A003", name: "Rohan Sharma", hostel: "CV Raman Boys Hostel (BH-2)", room: "105", meal: "breakfast", item: "Upma" },
    ];
    sample.forEach((s) => {
      rows.push({
        id: s.id,
        studentId: s.sid,
        studentName: s.name,
        hostel: s.hostel,
        room: s.room,
        mealDate: tmr,
        mealType: s.meal,
        selectedMenuItem: s.item,
        bookingStatus: "BOOKED",
        attendanceStatus: "PENDING",
        bookedAt: now,
      });
    });
    return rows;
  })();

  const announcements = [
    {
      id: "ann_1",
      title: "Mandatory Night Roll Call Timing Update",
      description: "All hostel residents are advised that the daily night roll call will strictly commence at 9:00 PM in respective block lobbies.",
      category: "hostel",
      audience: "All Students",
      hostel: "All Hostels",
      priority: "high",
      start_date: todayStr,
      expiry_date: "2026-12-31",
      visibility: "public",
    },
    {
      id: "ann_2",
      title: "Special Sunday Mess Feast Announcement",
      description: "This Sunday's lunch will feature a special festive menu with Dum Biryani, Paneer Butter Masala, and Sweets for all residents.",
      category: "mess",
      audience: "All Students",
      hostel: "All Hostels",
      priority: "medium",
      start_date: todayStr,
      expiry_date: "2026-12-31",
      visibility: "public",
    },
    {
      id: "ann_3",
      title: "Campus High-Speed Wi-Fi Maintenance Window",
      description: "Scheduled maintenance for Block A Wi-Fi routers on Saturday midnight between 1:00 AM and 3:00 AM. Internet may be briefly interrupted.",
      category: "maintenance",
      audience: "Block A Residents",
      hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
      priority: "medium",
      start_date: todayStr,
      expiry_date: "2026-12-31",
      visibility: "public",
    },
    {
      id: "ann_4",
      title: "Emergency Medical Doctor On Campus",
      description: "Resident Medical Officer Dr. S. K. Rao is available at the Health Center 24/7. Call extension 404 in emergency.",
      category: "emergency",
      audience: "All Students",
      hostel: "All Hostels",
      priority: "critical",
      start_date: todayStr,
      expiry_date: "2026-12-31",
      visibility: "public",
    },
    {
      id: "ann_5",
      title: "Annual Sports Tournament Registration Open",
      description: "Inter-hostel sports tournament registrations are now open for Cricket, Volleyball, Badminton, and Chess. Register with Warden office.",
      category: "events",
      audience: "All Students",
      hostel: "All Hostels",
      priority: "low",
      start_date: todayStr,
      expiry_date: "2026-12-31",
      visibility: "public",
    },
  ];

  const gatePasses = [
    {
      id: "gp_1",
      pass_id: "GP-2026-0801",
      student_id: "22091A001",
      student_name: "Aarav Reddy",
      hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
      room: "101",
      date: todayStr,
      exit_time: "17:00",
      expected_return: "20:30",
      reason: "Buying project hardware components at Nandyal market",
      destination: "Nandyal Main Market",
      status: "approved",
      qr_code: "GP-2026-0801|22091A001|Aarav Reddy|BH-1|101",
      gate: "Main Security Gate 1",
      security_staff: "Officer Ramesh Kumar",
      actual_return: "",
      return_status: "pending",
    },
    {
      id: "gp_2",
      pass_id: "GP-2026-0802",
      student_id: "22091A002",
      student_name: "Ananya Chowdhary",
      hostel: "Kalpana Chawla Girls Hostel (GH-1)",
      room: "203",
      date: todayStr,
      exit_time: "16:30",
      expected_return: "19:30",
      reason: "Visiting local guardian's home",
      destination: "Nandyal Town",
      status: "exited",
      qr_code: "GP-2026-0802|22091A002|Ananya Chowdhary|GH-1|203",
      gate: "Girls Hostel Security Gate",
      security_staff: "Officer Sunitha",
      actual_return: "",
      return_status: "pending",
    },
    {
      id: "gp_3",
      pass_id: "GP-2026-0803",
      student_id: "22091A003",
      student_name: "Rohan Sharma",
      hostel: "CV Raman Boys Hostel (BH-2)",
      room: "105",
      date: todayStr,
      exit_time: "18:00",
      expected_return: "21:00",
      reason: "Medical checkup at General Hospital",
      destination: "Government Hospital Nandyal",
      status: "pending",
      qr_code: "GP-2026-0803|22091A003|Rohan Sharma|BH-2|105",
      gate: "Main Security Gate 2",
      security_staff: "",
      actual_return: "",
      return_status: "pending",
    },
  ];

  const leaves = [
    {
      id: "lv_1",
      student_id: "22091A004",
      student_name: "Sai Rao",
      from_date: todayStr,
      to_date: "2026-08-30",
      reason: "Family function in Kurnool (Sister's wedding ceremony)",
      destination: "Kurnool",
      emergency_contact: "+91 94400 12345",
      status: "approved",
    },
    {
      id: "lv_2",
      student_id: "22091A005",
      student_name: "Kavya Naidu",
      from_date: todayStr,
      to_date: "2026-08-29",
      reason: "Attending National Level Hackathon at IIT Tirupati",
      destination: "Tirupati",
      emergency_contact: "+91 98480 54321",
      status: "pending",
    },
  ];

  const maintenance = [
    {
      id: "mt_1",
      ticket_id: "TKT-1089",
      student_id: "22091A001",
      student_name: "Aarav Reddy",
      hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
      room: "101",
      category: "electrical",
      priority: "high",
      description: "Ceiling fan making squeaking noise and running at low speed on regulator setting 5.",
      photo_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=80",
      status: "in_progress",
      assigned_to: "Electrician Subbaiah",
      sla_hours: 24,
      resolved_date: "",
      student_confirmed: false,
    },
    {
      id: "mt_2",
      ticket_id: "TKT-1090",
      student_id: "22091A002",
      student_name: "Ananya Chowdhary",
      hostel: "Kalpana Chawla Girls Hostel (GH-1)",
      room: "203",
      category: "plumbing",
      priority: "critical",
      description: "Bathroom sink faucet leaking water continuously.",
      photo_url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300&auto=format&fit=crop&q=80",
      status: "assigned",
      assigned_to: "Plumber Krishna",
      sla_hours: 12,
      resolved_date: "",
      student_confirmed: false,
    },
    {
      id: "mt_3",
      ticket_id: "TKT-1091",
      student_id: "22091A003",
      student_name: "Rohan Sharma",
      hostel: "CV Raman Boys Hostel (BH-2)",
      room: "105",
      category: "wifi",
      priority: "medium",
      description: "Wi-Fi signal weak inside room 105 compared to lobby.",
      photo_url: "",
      status: "new",
      assigned_to: "IT Helpdesk",
      sla_hours: 48,
      resolved_date: "",
      student_confirmed: false,
    },
  ];

  const inventory = [
    { id: "inv_1", item: "Sona Masoori Rice Bags (50kg)", category: "Mess Provisions", quantity: 45, unit: "bags", min_stock: 15, supplier: "Sri Lakshmi Wholesale", purchase_date: "2026-08-10", expiry: "2027-08-10", status: "in_stock" },
    { id: "inv_2", item: "Toor Dal (25kg)", category: "Mess Provisions", quantity: 18, unit: "bags", min_stock: 10, supplier: "Sri Lakshmi Wholesale", purchase_date: "2026-08-12", expiry: "2027-02-12", status: "in_stock" },
    { id: "inv_3", item: "Sunflower Cooking Oil (15L)", category: "Mess Provisions", quantity: 6, unit: "tins", min_stock: 10, supplier: "Freedom Oil Distributors", purchase_date: "2026-08-01", expiry: "2026-11-01", status: "low_stock" },
    { id: "inv_4", item: "Commercial Floor Cleaner (5L)", category: "Housekeeping", quantity: 12, unit: "cans", min_stock: 5, supplier: "CleanTech Supplies", purchase_date: "2026-08-15", expiry: "2028-08-15", status: "in_stock" },
    { id: "inv_5", item: "LED Bulbs 18W B22", category: "Electrical Repairs", quantity: 3, unit: "boxes", min_stock: 5, supplier: "Philips Electricals", purchase_date: "2026-07-20", expiry: "2028-07-20", status: "low_stock" },
    { id: "inv_6", item: "First Aid Antiseptic Cream", category: "Medical Clinic", quantity: 2, unit: "tubes", min_stock: 8, supplier: "Apollo Pharmacy", purchase_date: "2025-09-01", expiry: "2026-09-01", status: "expiring_soon" },
  ];

  const foodFeedback = [
    { id: "ff_1", rating: 5, taste: 5, quality: 4, cleanliness: 5, comments: "Breakfast idlis were soft and sambar was delicious!", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", date: todayStr },
    { id: "ff_2", rating: 4, taste: 4, quality: 4, cleanliness: 4, comments: "Good food today. Please add extra chutney for vada.", hostel: "Kalpana Chawla Girls Hostel (GH-1)", date: todayStr },
  ];

  const cleaning = [
    { id: "cl_1", room: "101", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", staff: "Subbarayudu", date: todayStr, checklist: { floor_mopped: true, bathroom_cleaned: true, trash_emptied: true, windows_dusted: false }, status: "completed", completion: 85 },
    { id: "cl_2", room: "203", hostel: "Kalpana Chawla Girls Hostel (GH-1)", staff: "Sujatha", date: todayStr, checklist: { floor_mopped: true, bathroom_cleaned: true, trash_emptied: true, windows_dusted: true }, status: "completed", completion: 100 },
    { id: "cl_3", room: "105", hostel: "CV Raman Boys Hostel (BH-2)", staff: "Ramanjaneyulu", date: todayStr, checklist: { floor_mopped: true, bathroom_cleaned: false, trash_emptied: false, windows_dusted: false }, status: "in_progress", completion: 35 },
  ];

  const entryExits = [
    { id: "ee_1", transaction_id: "TXN-8801", student_id: "22091A001", student_name: "Aarav Reddy", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", room: "101", date: todayStr, exit_time: "17:05", expected_return: "20:30", actual_return: "", status: "outside", gate: "Main Gate 1", security_staff: "Ramesh Kumar", purpose: "Market Shopping" },
    { id: "ee_2", transaction_id: "TXN-8802", student_id: "22091A002", student_name: "Ananya Chowdhary", hostel: "Kalpana Chawla Girls Hostel (GH-1)", room: "203", date: todayStr, exit_time: "16:35", expected_return: "19:30", actual_return: "", status: "outside", gate: "Girls Gate", security_staff: "Sunitha", purpose: "Guardian Visit" },
  ];

  const visitors = [
    { id: "vis_1", name: "Venkat Reddy", phone: "+91 94400 99887", relationship: "Father", student_id: "22091A001", student_name: "Aarav Reddy", purpose: "Delivering laptop charger & home food", entry_time: "14:15", expected_exit: "16:00", status: "exited", id_verification: "Aadhaar Verified" },
    { id: "vis_2", name: "Suresh Sharma", phone: "+91 98480 11223", relationship: "Uncle", student_id: "22091A003", student_name: "Rohan Sharma", purpose: "Family visit", entry_time: "15:30", expected_exit: "17:30", status: "inside", id_verification: "Voter ID Verified" },
  ];

  const notifications = [
    { id: "nt_1", type: "info", title: "Gate Pass Approved", message: "Your gate pass GP-2026-0801 for today has been approved by Warden.", role: "student", recipient: "22091A001", read: false, timestamp: new Date(Date.now() - 1800000).toISOString() },
    { id: "nt_2", type: "warning", title: "Maintenance Assigned", message: "Electrical ticket TKT-1089 assigned to Electrician Subbaiah.", role: "warden", recipient: "warden", read: true, timestamp: new Date(Date.now() - 3600000).toISOString() },
  ];

  const activityLogs = [
    { id: "act_1", user: "Warden Chief", role: "warden", action: "Approved Gate Pass GP-2026-0801", module: "GatePass", record: "gp_1", timestamp: new Date(Date.now() - 1800000).toISOString() },
    { id: "act_2", user: "Aarav Reddy", role: "student", action: "Submitted Maintenance Ticket TKT-1089", module: "Maintenance", record: "mt_1", timestamp: new Date(Date.now() - 5400000).toISOString() },
    { id: "act_3", user: "Security Desk", role: "security", action: "Checked out visitor Venkat Reddy", module: "Visitor", record: "vis_1", timestamp: new Date(Date.now() - 9000000).toISOString() },
  ];

  const settings = [
    { id: "st_1", key: "hostel_status", value: "All Systems Operational", category: "system" },
    { id: "st_2", key: "night_curfew_time", value: "21:00", category: "rules" },
    { id: "st_3", key: "emergency_contact", value: "+91 8514 275201", category: "contact" },
  ];
  // Per-student mess attendance (one central source of truth). Demo students
  // have believable scan history for today so every role dashboard has live
  // data out of the box. The demo student 22091A003 has ONLY breakfast so the
  // "SCAN MESS QR" flow can still be demonstrated live.
  const MESS_BY_HOSTEL: Record<string, { code: string; name: string }> = {
    [hostelNames[0]]: { code: "RGMCET-KRISHNA-MESS-01", name: "Krishna Mess Hall" },
    [hostelNames[1]]: { code: "RGMCET-RAMAN-MESS-02", name: "Raman Mess Hall" },
    [hostelNames[2]]: { code: "RGMCET-CHAWLA-MESS-03", name: "Chawla Mess Hall" },
  };
  const maRows: any[] = [];
  const maPlan = [
    { meal: "breakfast", skip: (i: number) => i % 15 === 0, hour: 8, min: (i: number) => 0 + (i % 50) },
    { meal: "lunch", skip: (i: number) => i % 9 === 0, hour: 12, min: (i: number) => 35 + (i % 25) },
    { meal: "snacks", skip: (i: number) => i % 3 === 0, hour: 16, min: (i: number) => 35 + (i % 20) },
  ];
  maPlan.forEach((plan) => {
for (let i = 1; i <= 105; i++) {
        const student_id = `22091A${String(i).padStart(3, "0")}`;
        const fname = student_id === "22091A003" ? "Rohan" : firstNames[i % firstNames.length];
        const lname = student_id === "22091A003" ? "Sharma" : lastNames[(i * 3) % lastNames.length];
        const studentName = `${fname} ${lname}`;
        const isGirl = ["Ananya", "Kavya", "Lakshmi", "Priya", "Divya", "Meghana", "Sneha", "Harini", "Deepika"].includes(fname);
        const hName = isGirl ? hostelNames[2] : i % 2 === 0 ? hostelNames[0] : hostelNames[1];
        // Demo student: only breakfast recorded.
        if (plan.meal !== "breakfast" && student_id === "22091A003") continue;
        if (plan.skip(i)) continue;
        const dt = new Date();
        dt.setHours(plan.hour, plan.min(i), i % 60, 0);
        const mess = MESS_BY_HOSTEL[hName];
        maRows.push({
          id: `ma_${plan.meal.slice(0, 4)}_${i}`,
          date: todayStr,
          meal: plan.meal,
          status: "recorded",
          student_id,
          student_name: studentName,
          hostel: hName,
          room: student_id === "22091A003" ? "105" : "101",
        mess_code: mess.code,
        mess_name: mess.name,
        scanned_at: dt.toISOString(),
        source: "student_qr",
      });
    }
  });

  const users = [
    {
      id: "usr_adm_1",
      email: "admin.hostel@rgmcet.edu.in",
      role: "admin",
      name: "System Admin",
      roleTitle: "Hostel Hub System Administrator",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      createdBy: "system",
      active: true,
    },
    {
      id: "usr_prn_1",
      email: "parent.demo@rgmcet.edu.in",
      role: "parent",
      name: "Mr. Sharma (Guardian)",
      roleTitle: "Parent / Guardian",
      avatarUrl: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=150&auto=format&fit=crop&q=80",
      studentId: "22091A003",
      hostel: "CV Raman Boys Hostel (BH-2)",
      room: "105",
      createdBy: "system",
      active: true,
    },
    {
      id: "usr_cw_1",
      email: "chief.warden@rgmcet.edu.in",
      role: "chief_warden",
      name: "Chief Warden",
      roleTitle: "Chief Warden",
      avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
      createdBy: "system",
      active: true,
    },
    {
      id: "usr_wd_1",
      email: "warden.hostel@rgmcet.edu.in",
      role: "warden",
      name: "Warden Chief",
      roleTitle: "Warden",
      hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
      createdBy: "system",
      active: true,
    },
    {
      id: "usr_mm_1",
      email: "mess.manager@rgmcet.edu.in",
      role: "mess_manager",
      name: "Mess Manager Kumar",
      roleTitle: "Mess Manager",
      hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
      createdBy: "system",
      active: true,
    },
    {
      id: "usr_sc_1",
      email: "security.hostel@rgmcet.edu.in",
      role: "security",
      name: "Security Ramesh",
      roleTitle: "Security Officer",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      createdBy: "system",
      active: true,
    },
    {
      id: "usr_hk_1",
      email: "housekeeping.hostel@rgmcet.edu.in",
      role: "housekeeping",
      name: "Housekeeping Lead",
      roleTitle: "Housekeeping Staff",
      avatarUrl: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=150&auto=format&fit=crop&q=80",
      createdBy: "system",
      active: true,
    },
  ];

  const messPoints = [
    { id: "msp_1", code: "RGMCET-KRISHNA-MESS-01", name: "Krishna Mess Hall", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", hall: "Ground Floor Block A", active: true, currentCycleCode: "RGMCET-KRISHNA-MESS-01", cycleExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), cycleActive: true, rotationDays: 3 },
    { id: "msp_2", code: "RGMCET-RAMAN-MESS-02", name: "Raman Mess Hall", hostel: "CV Raman Boys Hostel (BH-2)", hall: "Ground Floor Block A", active: true, currentCycleCode: "RGMCET-RAMAN-MESS-02", cycleExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), cycleActive: true, rotationDays: 3 },
    { id: "msp_3", code: "RGMCET-CHAWLA-MESS-03", name: "Chawla Mess Hall", hostel: "Kalpana Chawla Girls Hostel (GH-1)", hall: "Ground Floor Block A", active: true, currentCycleCode: "RGMCET-CHAWLA-MESS-03", cycleExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), cycleActive: true, rotationDays: 3 },
  ];

  const mealConfig = {
    id: "st_meal_config",
    key: "meal_config",
    category: "mess",
    breakfast: { start: "07:30", end: "09:00" },
    lunch: { start: "12:30", end: "14:00" },
    snacks: { start: "16:30", end: "17:30" },
    dinner: { start: "19:30", end: "21:00" },
    updated_at: new Date().toISOString(),
  };

  // ---- Night Roll Call seed data (sessions, checkpoints, records) ----
  const nrcConfig = {
    key: "nrc_config",
    category: "system",
    startTime: "21:30",
    endTime: "22:00",
    graceEndTime: "22:15",
    tokenTtlMinutes: 5,
    wifiSsid: "RGMCET-HOSTEL-WIFI",
    requireSelfie: false,
    requireWifi: false,
    enabled: true,
  };

  const nrcSessions = [
    { id: "nrcs_h1", hostelId: "h_1", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", date: todayStr, startTime: "21:30", endTime: "22:00", graceEndTime: "22:15", active: true, createdBy: "Warden Chief", createdAt: new Date().toISOString() },
    { id: "nrcs_h2", hostelId: "h_2", hostel: "CV Raman Boys Hostel (BH-2)", date: todayStr, startTime: "21:30", endTime: "22:00", graceEndTime: "22:15", active: true, createdBy: "Warden Chief", createdAt: new Date().toISOString() },
    { id: "nrcs_h3", hostelId: "h_3", hostel: "Kalpana Chawla Girls Hostel (GH-1)", date: todayStr, startTime: "21:30", endTime: "22:00", graceEndTime: "22:15", active: true, createdBy: "Warden Chief", createdAt: new Date().toISOString() },
  ];

  const nrcCheckpoints = [
    { id: "nrcc_1", hostelId: "h_1", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", blockId: "Block A", block: "Block A", floorId: "0", floor: "Ground", locationName: "Hostel Entrance", qrToken: Math.floor(100000 + Math.random() * 900000).toString(), tokenExpiry: new Date(Date.now() + 5 * 60000).toISOString(), active: true, createdAt: new Date().toISOString() },
    { id: "nrcc_2", hostelId: "h_1", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", blockId: "Block A", block: "Block A", floorId: "1", floor: "1", locationName: "Floor Notice Board", qrToken: Math.floor(100000 + Math.random() * 900000).toString(), tokenExpiry: new Date(Date.now() + 5 * 60000).toISOString(), active: true, createdAt: new Date().toISOString() },
    { id: "nrcc_3", hostelId: "h_1", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", blockId: "Block B", block: "Block B", floorId: "2", floor: "2", locationName: "Study Hall", qrToken: Math.floor(100000 + Math.random() * 900000).toString(), tokenExpiry: new Date(Date.now() + 5 * 60000).toISOString(), active: true, createdAt: new Date().toISOString() },
    { id: "nrcc_4", hostelId: "h_1", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", blockId: "Block A", block: "Block A", floorId: "3", floor: "3", locationName: "Common Area", qrToken: Math.floor(100000 + Math.random() * 900000).toString(), tokenExpiry: new Date(Date.now() + 5 * 60000).toISOString(), active: true, createdAt: new Date().toISOString() },
    { id: "nrcc_5", hostelId: "h_3", hostel: "Kalpana Chawla Girls Hostel (GH-1)", blockId: "Block A", block: "Block A", floorId: "0", floor: "Ground", locationName: "Hostel Entrance", qrToken: Math.floor(100000 + Math.random() * 900000).toString(), tokenExpiry: new Date(Date.now() + 5 * 60000).toISOString(), active: true, createdAt: new Date().toISOString() },
    { id: "nrcc_6", hostelId: "h_3", hostel: "Kalpana Chawla Girls Hostel (GH-1)", blockId: "Block B", block: "Block B", floorId: "1", floor: "1", locationName: "Reading Room", qrToken: Math.floor(100000 + Math.random() * 900000).toString(), tokenExpiry: new Date(Date.now() + 5 * 60000).toISOString(), active: true, createdAt: new Date().toISOString() },
  ];

  // Pre-populate a believable set of completed records for today's session h_1 so
  // the warden dashboard and analytics have meaningful live data out of the box.
  const nrcRecords: any[] = [];
  for (let i = 1; i <= 105; i++) {
    const student_id = `22091A${String(i).padStart(3, "0")}`;
    const isGirl = ["Ananya", "Kavya", "Lakshmi", "Priya", "Divya", "Meghana", "Sneha", "Harini", "Deepika"].includes(firstNames[i % firstNames.length]);
    const hName = isGirl ? hostelNames[2] : i % 2 === 0 ? hostelNames[0] : hostelNames[1];
    const sessionId = hName.includes("GH") ? "nrcs_h3" : hName.includes("BH-2") ? "nrcs_h2" : "nrcs_h1";
    const hostelId = hName.includes("GH") ? "h_3" : hName.includes("BH-2") ? "h_2" : "h_1";
    const gid = String(student_id).trim().toUpperCase();
    const hasGate = gatePasses.find((g) => String(g.student_id).trim().toUpperCase() === gid && g.date === todayStr && (g.status === "approved" || g.status === "exited"));
    const hasLeave = leaves.find((l) => String(l.student_id).trim().toUpperCase() === gid && l.status === "approved" && l.from_date <= todayStr && l.to_date >= todayStr);
    const isLate = i % 23 === 0;

    let status = "PRESENT";
    let method = "DYNAMIC_QR";
    let completedAt = "";
    if (hasGate) {
      status = "OUTSIDE";
      method = "MANUAL";
    } else if (hasLeave) {
      status = "ON_LEAVE";
      method = "MANUAL";
    } else if (isLate) {
      status = "LATE";
      method = "LATE_CHECKIN";
    }

    if (!hasGate && !hasLeave) {
      // simulate completion time inside window (21:32 - 21:58) or grace (22:01-22:12)
      const base = new Date();
      const m = i % 2 === 0 ? 21 + (i % 26) : 21 + ((i * 2) % 27);
      const hour = m >= 60 ? 22 : 21;
      const minute = m >= 60 ? m - 60 : m;
      const isGraceTime = hour === 22;
      if (isLate && !isGraceTime) {
        // late students check in during grace
        base.setHours(22, 3 + (i % 9), 0, 0);
      } else {
        base.setHours(hour, minute, i % 60, 0);
      }
      completedAt = base.toISOString();
    }

    nrcRecords.push({
      id: `nrcr_${i}`,
      sessionId,
      studentId: student_id,
      completedAt,
      status,
      verificationMethod: method,
      lateReason: status === "LATE" ? "Missed the scheduled roll-call window, arrived late." : "",
      exemptReason: status === "OUTSIDE" ? (hasGate ? `Exited hostel on gate pass` : "") : status === "ON_LEAVE" ? "Approved outstation leave" : "",
      hostelId,
      hostel: hName,
      checkpointId: status === "PRESENT" ? (hostelId === "h_1" ? `nrcc_${(i % 4) + 1}` : hostelId === "h_3" ? (i % 2 === 0 ? "nrcc_5" : "nrcc_6") : "") : "",
      networkVerified: status === "PRESENT",
      selfieUrl: "",
      createdAt: new Date().toISOString(),
    });
  }

  return [
    { name: "User", rows: users },
    { name: "Hostel", rows: hostels },
    { name: "Room", rows: rooms },
    { name: "Student", rows: students },
    { name: "Menu", rows: [...menus, ...bookingMenus] },
    { name: "MealBooking", rows: mealBookings },
    { name: "Announcement", rows: announcements },    { name: "GatePass", rows: gatePasses },
    { name: "Leave", rows: leaves },
    { name: "Maintenance", rows: maintenance },
    { name: "Inventory", rows: inventory },
    { name: "MessAttendance", rows: maRows },
    { name: "MessPoint", rows: messPoints },
    { name: "FoodFeedback", rows: foodFeedback },
    { name: "Cleaning", rows: cleaning },
    { name: "EntryExit", rows: entryExits },
    { name: "Visitor", rows: visitors },
    { name: "Notification", rows: notifications },
    { name: "ActivityLog", rows: activityLogs },
    { name: "Settings", rows: [...settings, mealConfig, { ...nrcConfig, id: "st_4" }] },
    { name: "NightRollCallSessions", rows: nrcSessions },
    { name: "NightRollCallCheckpoints", rows: nrcCheckpoints },
    { name: "NightRollCallRecords", rows: nrcRecords },
  ];
}

// ---------------------------------------------------------------------------
// Firestore seeding (runs once, gated by a marker doc in the _meta collection)
// ---------------------------------------------------------------------------

async function isSeeded() {
  try {
    const metaRef = doc(db, "_meta", SEED_META_DOC);
    const snap = await getDoc(metaRef);
    return snap.exists();
  } catch {
    // On any error retry next load so seeding self-heals once rules/network allow.
    return false;
  }
}

async function runSeed() {
  try {
    if (await isSeeded()) return;
    const datasets = buildSeedData();
    const batch = writeBatch(db);
    datasets.forEach(({ name, rows }) => {
      rows.forEach((row: any) => {
        const ref = doc(collection(db, name), row.id);
        batch.set(ref, row);
      });
    });
    batch.set(doc(db, "_meta", SEED_META_DOC), { seeded_at: new Date().toISOString() });
    await batch.commit();
    console.log("[Firestore] Seed data initialized.");
  } catch (err) {
    console.warn(
      "[Firestore] Seeding skipped (Firestore may need rules/network). The app will still read whatever data exists.",
      err
    );
  }
}

// ---------------------------------------------------------------------------
// Upgrade seed (v2) - integrated dashboard datasets.
//
// Runs in ADDITION to the original seed so projects that already have the base
// dataset still receive the Mess QR / MealAttendance / MessPoint / role-account
// data required by the integrated dashboards. It only ever writes NEW documents
// (plus removing the two now-obsolete aggregate MessAttendance docs) and never
// touches existing user-modified records.
// ---------------------------------------------------------------------------

const V2_EXTRA_USERS = [
  { id: "usr_prn_1", email: "parent.demo@rgmcet.edu.in", role: "parent", name: "Mr. Sharma (Guardian)", roleTitle: "Parent / Guardian", avatarUrl: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=150&auto=format&fit=crop&q=80", studentId: "22091A003", hostel: "CV Raman Boys Hostel (BH-2)", room: "105", createdBy: "system", active: true },
  { id: "usr_cw_1", email: "chief.warden@rgmcet.edu.in", role: "chief_warden", name: "Chief Warden", roleTitle: "Chief Warden", avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80", createdBy: "system", active: true },
  { id: "usr_wd_1", email: "warden.hostel@rgmcet.edu.in", role: "warden", name: "Warden Chief", roleTitle: "Warden", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80", createdBy: "system", active: true },
  { id: "usr_mm_1", email: "mess.manager@rgmcet.edu.in", role: "mess_manager", name: "Mess Manager Kumar", roleTitle: "Mess Manager", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80", createdBy: "system", active: true },
  { id: "usr_sc_1", email: "security.hostel@rgmcet.edu.in", role: "security", name: "Security Ramesh", roleTitle: "Security Officer", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80", createdBy: "system", active: true },
  { id: "usr_hk_1", email: "housekeeping.hostel@rgmcet.edu.in", role: "housekeeping", name: "Housekeeping Lead", roleTitle: "Housekeeping Staff", avatarUrl: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=150&auto=format&fit=crop&q=80", createdBy: "system", active: true },
];

const V2_MESS_POINTS = [
  { id: "msp_1", code: "RGMCET-KRISHNA-MESS-01", name: "Krishna Mess Hall", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", hall: "Ground Floor Block A", active: true, currentCycleCode: "RGMCET-KRISHNA-MESS-01", cycleExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), cycleActive: true, rotationDays: 3 },
  { id: "msp_2", code: "RGMCET-RAMAN-MESS-02", name: "Raman Mess Hall", hostel: "CV Raman Boys Hostel (BH-2)", hall: "Ground Floor Block A", active: true, currentCycleCode: "RGMCET-RAMAN-MESS-02", cycleExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), cycleActive: true, rotationDays: 3 },
  { id: "msp_3", code: "RGMCET-CHAWLA-MESS-03", name: "Chawla Mess Hall", hostel: "Kalpana Chawla Girls Hostel (GH-1)", hall: "Ground Floor Block A", active: true, currentCycleCode: "RGMCET-CHAWLA-MESS-03", cycleExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), cycleActive: true, rotationDays: 3 },
];

async function isUpgraded() {
  try {
    const metaRef = doc(db, "_meta", UPGRADE_META_DOC);
    const snap = await getDoc(metaRef);
    return snap.exists();
  } catch {
    return false;
  }
}

function v2MessAttendanceRows(students: any[], today: string) {
  const MESS: any = {
    "APJ Abdul Kalam Boys Hostel (BH-1)": { code: "RGMCET-KRISHNA-MESS-01", name: "Krishna Mess Hall" },
    "CV Raman Boys Hostel (BH-2)": { code: "RGMCET-RAMAN-MESS-02", name: "Raman Mess Hall" },
    "Kalpana Chawla Girls Hostel (GH-1)": { code: "RGMCET-CHAWLA-MESS-03", name: "Chawla Mess Hall" },
  };
  const rows: any[] = [];
  const plan = [
    { meal: "breakfast", skip: (i: number) => i % 15 === 0, hour: 8, min: (i: number) => 0 + (i % 50), demoOnly: false },
    { meal: "lunch", skip: (i: number) => i % 9 === 0, hour: 12, min: (i: number) => 35 + (i % 25), demoOnly: false },
    { meal: "snacks", skip: (i: number) => i % 3 === 0, hour: 16, min: (i: number) => 35 + (i % 20), demoOnly: false },
  ];
  students.slice(0, 200).forEach((s, idx) => {
    const i = idx + 1;
    const sid = String(s.student_id || "").trim();
    const mess = MESS[s.hostel] || { code: "RGMCET-KRISHNA-MESS-01", name: "Krishna Mess Hall" };
    plan.forEach((p) => {
      if (p.meal !== "breakfast" && sid === "22091A003") return;
      if (p.skip(i)) return;
      const dt = new Date();
      dt.setHours(p.hour, p.min(i), i % 60, 0);
      rows.push({
        id: `ma_${p.meal.slice(0, 4)}_${i}`,
        date: today,
        meal: p.meal,
        status: "recorded",
        student_id: s.student_id,
        student_name: s.name || "Student",
        hostel: s.hostel || "Unknown",
        room: s.room || "",
        mess_code: mess.code,
        mess_name: mess.name,
        scanned_at: dt.toISOString(),
        source: "student_qr",
      });
    });
  });
  return rows;
}

async function runUpgradeSeed() {
  try {
    if (await isUpgraded()) return;
    const today = new Date().toISOString().split("T")[0];

    // Reuse whatever students already exist so we never duplicate generation logic.
    const studentSnap = await getDocs(collection(db, "Student"));
    const students = studentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const batch = writeBatch(db);

    V2_EXTRA_USERS.forEach((u) => {
      batch.set(doc(collection(db, "User"), u.id), { ...u, created_at: new Date().toISOString() });
    });
    V2_MESS_POINTS.forEach((m) => {
      batch.set(doc(collection(db, "MessPoint"), m.id), { ...m, created_at: new Date().toISOString() });
    });
    batch.set(doc(collection(db, "Settings"), "st_meal_config"), {
      key: "meal_config",
      category: "mess",
      breakfast: { start: "07:30", end: "09:00" },
      lunch: { start: "12:30", end: "14:00" },
      snacks: { start: "16:30", end: "17:30" },
      dinner: { start: "19:30", end: "21:00" },
      updated_at: new Date().toISOString(),
    });

    v2MessAttendanceRows(students, today).forEach((r) => {
      batch.set(doc(collection(db, "MessAttendance"), r.id), r);
    });

    // Remove the two obsolete pre-integration aggregate rows.
    ["ma_1", "ma_2"].forEach((id) => batch.delete(doc(collection(db, "MessAttendance"), id)));

    batch.set(doc(db, "_meta", UPGRADE_META_DOC), { upgraded_at: new Date().toISOString() });
    await batch.commit();
    console.log("[Firestore] v2 upgrade seed initialized (Mess QR integration).");
  } catch (err) {
    console.warn("[Firestore] v2 upgrade seeding skipped.", err);
  }
}

// ---------------------------------------------------------------------------
// Upgrade seed (v3) - Meal Booking with menu-item selection.
//
// Idempotent. Adds daily menus for the next few days and sample MealBooking
// records so the advance-booking + item-wise analytics feature has demo data on
// projects that were already seeded before this feature existed.
// ---------------------------------------------------------------------------

const BOOKING_UPGRADE_META = "meal_booking_state";

function v3BookingMenus(hostels: string[]): any[] {
  const rows: any[] = [];
  const days = [
    { breakfast: ["Upma", "Bread with Butter and Jam"], lunch: ["Veg Biryani", "Lemon Rice"], dinner: ["Chapati with Curry", "Fried Rice"] },
    { breakfast: ["Idli & Sambar", "Dosa with Chutney"], lunch: ["Steamed Rice with Dal", "Curd Rice"], dinner: ["Paneer Roti", "Veg Pulao"] },
    { breakfast: ["Pongal", "Mysore Bonda"], lunch: ["Veg Fried Rice", "Tomato Rice"], dinner: ["Chole Bhature", "Jeera Rice"] },
  ];
  let idx = 0;
  for (let ahead = 1; ahead <= 3; ahead++) {
    const base = new Date(todayStr());
    base.setDate(base.getDate() + ahead);
    const date = base.toISOString().split("T")[0];
    const sp = days[idx % days.length];
    idx++;
    hostels.forEach((hostel, h) => {
      rows.push({
        id: `menu_bk_${ahead}_${h}`,
        date,
        hostel,
        breakfast: sp.breakfast,
        lunch: sp.lunch,
        snacks: ["Masala Chai", "Banana", "Biscuits"],
        dinner: sp.dinner,
        special: "",
        festival: "",
        is_special: ahead % 2 === 0,
        is_veg: true,
        updated_at: new Date().toISOString(),
      });
    });
  }
  return rows;
}

function v3SampleBookings(): any[] {
  const tomorrow = new Date(todayStr());
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tmr = tomorrow.toISOString().split("T")[0];
  const now = new Date().toISOString();
  return [
    { id: "mbk_1", studentId: "22091A001", studentName: "Aarav Reddy", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", room: "101", mealDate: tmr, mealType: "breakfast", selectedMenuItem: "Upma", bookingStatus: "BOOKED", attendanceStatus: "PENDING", bookedAt: now },
    { id: "mbk_2", studentId: "22091A002", studentName: "Ananya Chowdhary", hostel: "Kalpana Chawla Girls Hostel (GH-1)", room: "203", mealDate: tmr, mealType: "breakfast", selectedMenuItem: "Bread with Butter and Jam", bookingStatus: "BOOKED", attendanceStatus: "PENDING", bookedAt: now },
    { id: "mbk_3", studentId: "22091A003", studentName: "Rohan Sharma", hostel: "CV Raman Boys Hostel (BH-2)", room: "105", mealDate: tmr, mealType: "breakfast", selectedMenuItem: "Upma", bookingStatus: "BOOKED", attendanceStatus: "PENDING", bookedAt: now },
  ];
}

async function runBookingUpgradeSeed() {
  try {
    const metaRef = doc(db, "_meta", BOOKING_UPGRADE_META);
    const snap = await getDoc(metaRef);
    if (snap.exists()) return;

    const hostels = [
      "APJ Abdul Kalam Boys Hostel (BH-1)",
      "CV Raman Boys Hostel (BH-2)",
      "Kalpana Chawla Girls Hostel (GH-1)",
    ];

    const batch = writeBatch(db);
    v3BookingMenus(hostels).forEach((m) => {
      batch.set(doc(collection(db, "Menu"), m.id), m);
    });
    v3SampleBookings().forEach((b) => {
      batch.set(doc(collection(db, "MealBooking"), b.id), b);
    });
    batch.set(metaRef, { upgraded_at: new Date().toISOString() });
    await batch.commit();
    console.log("[Firestore] v3 meal-booking seed initialized.");
  } catch (err) {
    console.warn("[Firestore] v3 meal-booking seeding skipped.", err);
  }
}

// ---------------------------------------------------------------------------
// Upgrade seed (v4) - Smart gate security & parent WhatsApp notifications.
//
// Idempotent. Adds the Gate config + append-only GateLog audit trail, links
// Parent documents (used by whatsappNotifier parent resolution) to seeded
// students, stamps student hostel_status, and marks seeded gate passes with
// the opaque QR token the secure scanner accepts.
// ---------------------------------------------------------------------------

const SMART_GATE_META = "smart_gate_security_state";

async function runSmartGateUpgradeSeed() {
  try {
    const metaRef = doc(db, "_meta", SMART_GATE_META);
    const snap = await getDoc(metaRef);
    if (snap.exists()) return;

    const now = new Date().toISOString();
    const today = todayStr();
    const batch = writeBatch(db);

    const parents = [
      { id: "par_001", name: "Mr. Rajesh Reddy", relationship: "Father", student_id: "22091A001", students: ["std_1"], whatsapp_number: "+91 94400 20001", phone: "+91 94400 20001", notification_enabled: true },
      { id: "par_002", name: "Mr. Anand Chowdhary", relationship: "Father", student_id: "22091A002", students: ["std_2"], whatsapp_number: "+91 94400 20002", phone: "+91 94400 20002", notification_enabled: true },
      { id: "par_003", name: "Mr. Suresh Sharma", relationship: "Father", student_id: "22091A003", students: ["std_3"], whatsapp_number: "+91 94400 20003", phone: "+91 94400 20003", notification_enabled: true },
    ];
    parents.forEach((p) => batch.set(doc(collection(db, "Parent"), p.id), { ...p, created_at: now }));

    // Student hostel status tells every dashboard whether a resident is on campus.
    [
      { id: "std_1", patch: { hostel_status: "outside" } },
      { id: "std_2", patch: { hostel_status: "outside" } },
      { id: "std_3", patch: { hostel_status: "inside" } },
    ].forEach(({ id, patch }) => batch.set(doc(collection(db, "Student"), id), patch, { merge: true }));

    // Secure tokens for the seeded gate passes so the scanner's opaque-token
    // path works out of the box (legacy qr_code is kept for backwards scans).
    const gatePassTokens: Record<string, any> = {
      gp_1: { qr_token: "seed01a1b2c3d4e5f60718293a4b5c6d7e8f0", pass_number: "GP-2026-0801" },
      gp_2: { qr_token: "seed02f0e9d8c7b6a5948372615049384756", pass_number: "GP-2026-0802" },
      gp_3: { qr_token: "seed03a5f4e3d2c1b0a99887766554d4c3b2a", pass_number: "GP-2026-0803" },
    };
    Object.entries(gatePassTokens).forEach(([id, patch]) =>
      batch.set(doc(collection(db, "GatePass"), id), patch, { merge: true })
    );

    const gates = [
      { id: "gt_1", name: "Main Security Gate 1", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", active: true, created_at: now },
      { id: "gt_2", name: "Main Security Gate 2", hostel: "CV Raman Boys Hostel (BH-2)", active: true, created_at: now },
      { id: "gt_3", name: "Girls Hostel Security Gate", hostel: "Kalpana Chawla Girls Hostel (GH-1)", active: true, created_at: now },
    ];
    gates.forEach((g) => batch.set(doc(collection(db, "Gate"), g.id), g));

    const gateLogs = [
      { id: "gl_1", transaction_id: "TXN-GATE-1001", action: "EXIT", date: today, exit_time: "17:05", expected_return: "20:30", gate_id: "gt_1", gate_name: "Main Security Gate 1", student_id: "22091A001", student_name: "Aarav Reddy", hostel: "APJ Abdul Kalam Boys Hostel (BH-1)", room: "101", pass_id: "gp_1", pass_number: "GP-2026-0801", method: "QR+FACE", liveness_passed: true, face_match: true, status: "outside", security_staff: "Officer Ramesh Kumar", timestamp: now },
      { id: "gl_2", transaction_id: "TXN-GATE-1002", action: "EXIT", date: today, exit_time: "16:35", expected_return: "19:30", gate_id: "gt_3", gate_name: "Girls Hostel Security Gate", student_id: "22091A002", student_name: "Ananya Chowdhary", hostel: "Kalpana Chawla Girls Hostel (GH-1)", room: "203", pass_id: "gp_2", pass_number: "GP-2026-0802", method: "QR+FACE", liveness_passed: true, face_match: true, status: "outside", security_staff: "Officer Sunitha", timestamp: now },
    ];
    gateLogs.forEach((l) => batch.set(doc(collection(db, "GateLog"), l.id), l));

    batch.set(metaRef, { upgraded_at: now });
    await batch.commit();
    console.log("[Firestore] v4 smart-gate & parent-notification seed initialized.");
  } catch (err) {
    console.warn("[Firestore] v4 smart-gate seeding skipped.", err);
  }
}

(async () => {
  await runSeed();
  // Provision a ready-to-login demo student (Firebase Auth + Firestore profile)
  // after the base dataset exists so its linked Student record is available.
  await provisionDemoStudent();
  // v2 upgrade seed for the integrated dashboard datasets (idempotent).
  await runUpgradeSeed();
  // v3 upgrade seed for meal booking with menu-item selection (idempotent).
  await runBookingUpgradeSeed();
  // v4 upgrade seed for smart gate security + parent WhatsApp notifications.
  await runSmartGateUpgradeSeed();
  const { provisionDemoUsers } = await import("./demoUsersSeed");
  await provisionDemoUsers();
})();
