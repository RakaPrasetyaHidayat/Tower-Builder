import { Client, Room } from "colyseus.js";

const DEFAULT_API_URL = "https://brave-balance-production-f894.up.railway.app";
const DEFAULT_WS_URL = "wss://brave-balance-production-f894.up.railway.app";

export function getApiBaseUrl(): string {
  return DEFAULT_API_URL;
}

function getWsUrl(): string {
  return DEFAULT_WS_URL;
}

export const colyseusClient = new Client(getWsUrl());

export function generateClientRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createGameRoom(nickname: string, roomCode = generateClientRoomCode()): Promise<Room<any>> {
  return colyseusClient.create("tower_room", {
    isHost: true,
    nickname: nickname.trim(),
    roomCode,
  });
}

/**
 * Cari roomId dari server berdasarkan roomCode, lalu join by ID.
 * Ini memastikan tidak ada room baru yang dibuat secara tidak sengaja.
 */
async function findRoomId(roomCode: string): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/room/${roomCode.toUpperCase()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.roomId || null;
  } catch {
    return null;
  }
}

export async function joinGameRoom(
  roomCode: string,
  nickname: string
): Promise<Room<any>> {
  const cleanCode = roomCode.trim().toUpperCase();

  // Cari roomId dulu via REST — ini tidak membuat room baru
  const roomId = await findRoomId(cleanCode);

  if (roomId) {
    // Join langsung ke room yang ada berdasarkan ID
    return colyseusClient.joinById(roomId, {
      roomCode: cleanCode,
      isHost: false,
      nickname: nickname.trim(),
    });
  }

  throw new Error("Sayembara tidak ditemukan atau server pencarian room tidak dapat dihubungi.");
}

export async function reconnectGameRoom(
  reconnectionToken: string
): Promise<Room<any>> {
  return colyseusClient.reconnect(reconnectionToken);
}
