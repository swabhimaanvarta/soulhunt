import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CourseCurriculum, CampusLocation } from "@/models";

const ModuleSchema = z.object({
  moduleNumber: z.number().int().min(1),
  title: z.string().min(2),
  topics: z.array(z.string().min(1)).min(1),
  learningOutcomes: z.array(z.string().min(1)).min(1),
  approvedSyllabusText: z.string().min(10),
});

const CourseCurriculumSchema = z.object({
  courseCode: z.string().min(2).max(12),
  courseName: z.string().min(3).max(100),
  department: z.string().min(2).max(60),
  semester: z.number().int().min(1).max(8),
  modules: z.array(ModuleSchema).min(1),
  approvedLocationIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isFacultyApproved: z.boolean().optional(),
  approvalNotes: z.string().optional(),
});

/**
 * GET /api/admin/courses
 * Strictly idempotent, read-only query. Never mutates the database.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { success: false, error: "Only Admins and Staff can access Course Curriculums." },
        { status: 403 }
      );
    }

    await connectDB();

    const approvedOnly = req.nextUrl.searchParams.get("approvedOnly") === "true";
    const query: any = { isActive: true };
    if (approvedOnly) {
      query.isFacultyApproved = true;
    }

    const courses = await CourseCurriculum.find(query)
      .populate("approvedLocationIds", "name code isSafeDesk")
      .populate("approvedBy", "displayName email username")
      .sort({ department: 1, semester: 1, courseCode: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: courses,
      total: courses.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load course curriculums." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/courses
 * Create/update course curriculum, or explicitly seed example curricula in unapproved draft status.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only Administrators can create or update course curricula." },
        { status: 403 }
      );
    }

    await connectDB();

    const action = req.nextUrl.searchParams.get("action");
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty if invoking action via query param
    }

    // Explicit example seeding action: strictly marks curricula as isExample: true and isFacultyApproved: false
    if (action === "seed-examples" || body.action === "seed-examples") {
      const locations = await CampusLocation.find().lean();
      const compLoc = locations.find((l) => l.code === "COMP-AI") || locations[0];
      const libLoc = locations.find((l) => l.code === "LIB-CENTRAL") || locations[0];
      const adminLoc = locations.find((l) => l.code === "BLK-ADMIN") || locations[0];

      const defaultCurricula = [
        {
          courseCode: "CS201",
          courseName: "Data Structures & Algorithms",
          department: "Computer Engineering",
          semester: 3,
          modules: [
            {
              moduleNumber: 1,
              title: "Linear Data Structures & Hashing",
              topics: ["Stack LIFO", "Queue FIFO", "Hash Tables", "Collision Resolution"],
              learningOutcomes: [
                "Calculate hash indices using division-modulo method",
                "Analyze time complexity of stack and queue operations",
                "Trace linear probing collision sequences",
              ],
              approvedSyllabusText:
                "Stack adheres to Last-In First-Out (LIFO); operations Push and Pop run in O(1) time. Queue adheres to First-In First-Out (FIFO); Enqueue and Dequeue run in O(1) time. Closed hashing using linear probing: index = (hash(key) + i) mod table_size. For key k and table size m=7 with hash(k) = k mod 7, collision resolution tries (hash(k) + 1) mod 7.",
            },
            {
              moduleNumber: 2,
              title: "Trees & Graph Traversals",
              topics: ["Binary Search Trees", "Tree Traversals", "Breadth-First Search", "Depth-First Search"],
              learningOutcomes: [
                "Determine in-order traversal of a binary search tree",
                "Apply Breadth-First Search (BFS) to find shortest path in unweighted graphs",
                "Calculate tree height and balance factors",
              ],
              approvedSyllabusText:
                "A Binary Search Tree (BST) maintains that for any node X, all keys in left subtree are strictly less than X, and all keys in right subtree are greater than X. In-order traversal (Left, Root, Right) of any BST yields keys in strictly ascending sorted order. BFS utilizes a FIFO queue; DFS utilizes recursion or an explicit LIFO stack.",
            },
          ],
          approvedLocationIds: compLoc ? [compLoc._id, libLoc._id] : [],
          version: 1,
          isActive: true,
          isExample: true,
          isFacultyApproved: false,
          approvalNotes: "Demo curriculum template. Requires explicit faculty confirmation before student quest generation.",
        },
        {
          courseCode: "EC302",
          courseName: "Digital Signal Processing & Microcontrollers",
          department: "Electronics & Communication",
          semester: 5,
          modules: [
            {
              moduleNumber: 1,
              title: "Sampling Theorem & Signal Discretization",
              topics: ["Nyquist-Shannon Sampling", "Aliasing", "Discrete Fourier Transform (DFT)"],
              learningOutcomes: [
                "Calculate the Nyquist rate for band-limited analog signals",
                "Determine discrete frequency bin resolution for N-point DFT",
                "Identify anti-aliasing filter cutoff requirements",
              ],
              approvedSyllabusText:
                "Nyquist-Shannon sampling theorem states that a continuous-time band-limited signal with maximum frequency component fmax can be uniquely reconstructed from its samples if the sampling frequency satisfies fs >= 2 * fmax. Sampling at fs < 2 * fmax introduces irreversible spectral folding called aliasing. Anti-aliasing analog low-pass filter must precede the analog-to-digital converter.",
            },
          ],
          approvedLocationIds: compLoc ? [compLoc._id] : [],
          version: 1,
          isActive: true,
          isExample: true,
          isFacultyApproved: false,
          approvalNotes: "Demo curriculum template. Requires explicit faculty confirmation before student quest generation.",
        },
        {
          courseCode: "MA102",
          courseName: "Discrete Mathematics & Applied Cryptography",
          department: "Mathematics & Basic Sciences",
          semester: 2,
          modules: [
            {
              moduleNumber: 1,
              title: "Modular Arithmetic & Public Key Cryptography",
              topics: ["Euler Totient", "Modular Inverse", "RSA Algorithm", "Fermat Little Theorem"],
              learningOutcomes: [
                "Compute Euler totient phi(n) for composite modulus n = p * q",
                "Verify coprime conditions using Euclidean algorithm",
                "Derive RSA public/private key exponents",
              ],
              approvedSyllabusText:
                "Euler totient function phi(n) calculates the number of positive integers up to n that are relatively prime to n. For distinct primes p and q, phi(p*q) = (p - 1) * (q - 1). In the RSA cryptosystem, public modulus is n = p * q, and the public exponent e satisfies gcd(e, phi(n)) = 1. The private exponent d satisfies (d * e) mod phi(n) = 1.",
            },
          ],
          approvedLocationIds: libLoc && adminLoc ? [libLoc._id, adminLoc._id] : [],
          version: 1,
          isActive: true,
          isExample: true,
          isFacultyApproved: false,
          approvalNotes: "Demo curriculum template. Requires explicit faculty confirmation before student quest generation.",
        },
      ];

      const inserted = [];
      for (const cur of defaultCurricula) {
        const exist = await CourseCurriculum.findOne({ courseCode: cur.courseCode });
        if (!exist) {
          const doc = await CourseCurriculum.create(cur);
          inserted.push(doc);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Seeded ${inserted.length} example curricula in unapproved draft status. Faculty review required.`,
        data: inserted,
      });
    }

    const parsed = CourseCurriculumSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Validation failed for course curriculum.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const isApproved = Boolean(data.isFacultyApproved);

    const existing = await CourseCurriculum.findOne({ courseCode: data.courseCode.toUpperCase() });
    if (existing) {
      existing.courseName = data.courseName;
      existing.department = data.department;
      existing.semester = data.semester;
      existing.modules = data.modules as any;
      if (data.approvedLocationIds) {
        existing.approvedLocationIds = data.approvedLocationIds.map((id) => new Types.ObjectId(id));
      }
      if (typeof data.isActive === "boolean") {
        existing.isActive = data.isActive;
      }
      if (typeof data.isFacultyApproved === "boolean") {
        existing.isFacultyApproved = data.isFacultyApproved;
        if (data.isFacultyApproved) {
          existing.approvedBy = user._id;
          existing.approvedAt = new Date();
          existing.approvalNotes = data.approvalNotes || "Approved by faculty administrator.";
        }
      }
      existing.version += 1;
      existing.ownerId = user._id;
      await existing.save();

      return NextResponse.json({
        success: true,
        message: `Course ${existing.courseCode} updated to version ${existing.version}.`,
        data: existing,
      });
    }

    const created = await CourseCurriculum.create({
      courseCode: data.courseCode.toUpperCase(),
      courseName: data.courseName,
      department: data.department,
      semester: data.semester,
      modules: data.modules,
      approvedLocationIds: (data.approvedLocationIds || []).map((id) => new Types.ObjectId(id)),
      ownerId: user._id,
      version: 1,
      isActive: data.isActive ?? true,
      isExample: false,
      isFacultyApproved: isApproved,
      approvedBy: isApproved ? user._id : null,
      approvedAt: isApproved ? new Date() : null,
      approvalNotes: isApproved ? data.approvalNotes || "Approved upon curriculum creation." : "",
    });

    return NextResponse.json(
      {
        success: true,
        message: `Course ${created.courseCode} created successfully.`,
        data: created,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save course curriculum." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/courses
 * Deliberate faculty approval or revocation of course curricula.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only Faculty Administrators can approve course curricula." },
        { status: 403 }
      );
    }

    await connectDB();
    const body = await req.json();
    const { courseId, isFacultyApproved, notes } = body;

    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return NextResponse.json(
        { success: false, error: "Valid courseId is required for curriculum approval." },
        { status: 400 }
      );
    }

    const course = await CourseCurriculum.findById(courseId);
    if (!course) {
      return NextResponse.json(
        { success: false, error: "Course curriculum not found." },
        { status: 404 }
      );
    }

    const approve = Boolean(isFacultyApproved);
    course.isFacultyApproved = approve;
    course.approvedBy = approve ? user._id : null;
    course.approvedAt = approve ? new Date() : null;
    course.approvalNotes = notes || (approve ? `Faculty approved by ${user.displayName || user.username}` : "Approval revoked");
    await course.save();

    return NextResponse.json({
      success: true,
      message: `Course ${course.courseCode} ${approve ? "approved for academic quest generation" : "unapproved"}.`,
      data: course,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update curriculum approval status." },
      { status: 500 }
    );
  }
}
