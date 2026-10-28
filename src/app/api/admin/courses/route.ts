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
});

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

    let courses = await CourseCurriculum.find({ isActive: true })
      .populate("approvedLocationIds", "name code isSafeDesk")
      .sort({ department: 1, semester: 1, courseCode: 1 })
      .lean();

    // If no course curricula exist yet, seed high-quality baseline curricula for the pilot
    if (courses.length === 0) {
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
                "Nyquist-Shannon Sampling Theorem: to prevent aliasing, the sampling frequency fs must satisfy fs >= 2 * fmax, where fmax is the maximum frequency component. The minimum required sampling rate fs = 2 * fmax is termed the Nyquist rate. For an N-point DFT sampled at fs, the frequency spacing between bins is delta_f = fs / N.",
            },
          ],
          approvedLocationIds: compLoc ? [compLoc._id] : [],
          version: 1,
          isActive: true,
        },
        {
          courseCode: "MA102",
          courseName: "Discrete Mathematics & Applied Cryptography",
          department: "Applied Sciences & Humanities",
          semester: 2,
          modules: [
            {
              moduleNumber: 1,
              title: "Modular Arithmetic & RSA Key Cryptography",
              topics: ["Euclidean Algorithm", "Modular Multiplicative Inverse", "RSA Key Generation"],
              learningOutcomes: [
                "Compute greatest common divisor using Euclidean algorithm",
                "Calculate Euler totient function phi(n) = (p-1)*(q-1)",
                "Verify RSA public and private key exponents",
              ],
              approvedSyllabusText:
                "Euclidean Algorithm: gcd(a, b) = gcd(b, a mod b) until remainder is zero. In RSA cryptography: select two distinct primes p and q. Modulus n = p * q. Euler totient phi(n) = (p - 1) * (q - 1). Public exponent e is chosen coprime to phi(n). Private exponent d is the modular multiplicative inverse of e mod phi(n): (d * e) mod phi(n) = 1.",
            },
          ],
          approvedLocationIds: adminLoc ? [adminLoc._id, libLoc._id] : [],
          version: 1,
          isActive: true,
        },
      ];

      await CourseCurriculum.insertMany(defaultCurricula);
      courses = await CourseCurriculum.find({ isActive: true })
        .populate("approvedLocationIds", "name code isSafeDesk")
        .sort({ department: 1, semester: 1, courseCode: 1 })
        .lean();
    }

    return NextResponse.json({
      success: true,
      data: courses,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch course curricula." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Only Administrators can create or update course curricula." },
        { status: 403 }
      );
    }

    const body = await req.json();
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

    await connectDB();
    const data = parsed.data;

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

