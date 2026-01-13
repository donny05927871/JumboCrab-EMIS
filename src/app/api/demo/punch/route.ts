import { NextRequest, NextResponse } from "next/server";

type PunchType = "TIME_IN" | "BREAK_IN" | "BREAK_OUT" | "TIME_OUT";

const ORDER: PunchType[] = ["TIME_IN", "BREAK_IN", "BREAK_OUT", "TIME_OUT"];

function nextPunch(last?: PunchType): PunchType {
  if (!last) return "TIME_IN";
  const idx = ORDER.indexOf(last);
  if (idx < 0) return "TIME_IN";
  return ORDER[Math.min(idx + 1, ORDER.length - 1)];
}

function todayKey(d = new Date()) {
  // YYYY-MM-DD in server time
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ In-memory punch state (NO DB). Resets on restart / redeploy.
const globalAny = globalThis as any;
const punchState: Map<
  string,
  { date: string; last?: PunchType; history: { type: PunchType; at: number }[] }
> = globalAny.__PUNCH_STATE__ ?? new Map();
globalAny.__PUNCH_STATE__ = punchState;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const employeeId = String(body.employeeId ?? "");
    const employeeName = String(body.employeeName ?? "");
    const kioskId = String(body.kioskId ?? "");
    const nonce = String(body.nonce ?? "");
    const exp = Number(body.exp ?? 0); // epoch ms from kiosk QR
    const deviceId = String(body.deviceId ?? "");

    if (!employeeId || !employeeName || !kioskId || !nonce || !deviceId) {
      return NextResponse.json(
        { ok: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    // Expiry check: reject if the kiosk challenge is already expired
    if (!exp || Date.now() > exp) {
      return NextResponse.json(
        { ok: false, error: "Kiosk QR expired. Please rescan." },
        { status: 400 }
      );
    }

    // Determine next punch server-side (authoritative)
    const key = employeeId;
    const today = todayKey();

    const existing = punchState.get(key);
    const state =
      existing && existing.date === today
        ? existing
        : { date: today, last: undefined, history: [] as any[] };

    const punch = nextPunch(state.last);
    const at = Date.now();

    state.last = punch;
    state.history.push({ type: punch, at });
    punchState.set(key, state);

    return NextResponse.json({
      ok: true,
      employeeId,
      employeeName,
      kioskId,
      punch,
      at,
      historyCount: state.history.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
