import { Client, Room } from "colyseus.js";

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
  const roomPromise = colyseusClient.create("tower_room", {
    isHost: true,
    nickname: nickname.trim(),
    roomCode,
  });

  return Promise.race([
    roomPromise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Gagal membuat room: Koneksi timeout ke Server Colyseus (ws://localhost:2567). Pastikan server backend berjalan di port 2567."
            )
          ),
        6000
      )
    ),
  ]);
}

export async function joinGameRoom(
  roomCode: string,
  nickname: string
): Promise<Room<any>> {
  const cleanCode = roomCode.trim().toUpperCase();
  const roomPromise = colyseusClient.joinOrCreate("tower_room", {
    roomCode: cleanCode,
    isHost: false,
    nickname: nickname.trim(),
  });

  return Promise.race([
    roomPromise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Kode Room #${cleanCode} tidak ditemukan atau server Colyseus tidak merespon.`
            )
          ),
        6000
      )
    ),
  ]);
}
