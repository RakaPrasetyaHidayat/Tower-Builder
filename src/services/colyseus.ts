import { Client, Room } from "colyseus.js";

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:2567`;
}

function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:2567`;
}

export const colyseusClient = new Client(getWsUrl());

function generateClientRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createGameRoom(nickname: string): Promise<Room<any>> {
  const roomCode = generateClientRoomCode();
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

  // Fallback: joinOrCreate (hanya dipakai kalau API room tidak bisa dicapai)
  return colyseusClient.joinOrCreate("tower_room", {
    roomCode: cleanCode,
    isHost: false,
    nickname: nickname.trim(),
  });
}

export async function reconnectGameRoom(
  reconnectionToken: string
): Promise<Room<any>> {
  return colyseusClient.reconnect(reconnectionToken);
}
