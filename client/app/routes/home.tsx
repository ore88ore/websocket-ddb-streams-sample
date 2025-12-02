import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/home";

const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL;

export function meta({}: Route.MetaArgs) {
  return [{ title: "Websocket Todos" }];
}

export default function Home() {
  const [todos, setTodos] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [modal, setModal] = useState<
    { mode: "create" | "update"; id?: string; title: string; status: string }
  | null
  >(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "TODO", label: "TODO" },
    { value: "inProgress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ];

  const statusChipClass = (status?: string) => {
    const map: Record<string, string> = {
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      inProgress: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
    return map[status ?? ""] ?? "bg-slate-100 text-slate-600 border-slate-200";
  };

  const statusLabel = (status?: string) => {
    if (!status) return "unknown";
    return status
      .replace(/([A-Z])/g, " $1")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  };

  useEffect(() => {
    ws.current = new WebSocket(websocketUrl);

    ws.current.onopen = () => {
      console.log("Connected");
      setIsConnected(true);
      ws.current?.send(JSON.stringify({ action: "getTodos" }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received:", data);

      setTodos((prev) => {
        const newTodos = [...prev];
        data.forEach((msg: any) => {
          // 同じIDがあれば上書き、なければ追加
          const index = newTodos.findIndex((t) => t.id === msg.item.id);
          if (index > -1) {
            newTodos[index] = msg.item;
          } else {
            newTodos.push(msg.item);
          }
        });
        return newTodos;
      });

      const latestUpdate = [...data].reverse().find((msg: any) => msg.type === "UPDATE");
      if (latestUpdate?.item) {
        const title = latestUpdate.item.title ?? "Untitled";
        setStatusMessage(`${title} のステータスが ${statusLabel(latestUpdate.item.status)} に更新されました。`);
      }
    };

    ws.current.onclose = () => setIsConnected(false);

    return () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const openAddModal = () => setModal({ mode: "create", title: "", status: "pending" });
  const openEditModal = (todo: any) =>
    setModal({
      mode: "update",
      id: todo.id,
      title: todo.title ?? "",
      status: todo.status ?? "pending",
    });
  const closeModal = () => setModal(null);

  const submitModal = () => {
    if (!modal || !ws.current || !isConnected) return;
    const title = modal.title.trim();
    if (!title) return;

    ws.current.send(
      JSON.stringify({
        action: "updateTodo",
        data: {
          id: modal.mode === "update" ? modal.id : undefined,
          title,
          status: modal.status,
        },
      })
    );
    setModal(null);
  };

  const canSave = modal ? Boolean(modal.title.trim()) && isConnected : false;

  return (
    <main className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Realtime Todos</h1>
          <span className={`text-xs font-medium ${isConnected ? "text-emerald-600" : "text-rose-500"}`}>
            {isConnected ? "online" : "offline"}
          </span>
        </div>

        {statusMessage && (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </div>
        )}

        <button
          onClick={openAddModal}
          disabled={!isConnected}
          className={`w-full rounded-xl px-4 py-2 text-sm font-semibold ${
            isConnected ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-400"
          }`}
        >
          Add Todo
        </button>

        {todos.length === 0 ? (
          <p className="text-sm text-slate-500 text-center border border-dashed border-slate-200 rounded-xl py-6">
            表示するデータがありません
          </p>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li key={todo.id}>
                <button
                  type="button"
                  onClick={() => openEditModal(todo)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{todo.title}</p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusChipClass(
                        todo.status
                      )}`}
                    >
                      {statusLabel(todo.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">ID: {todo.id}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4">
            <h2 className="text-lg font-semibold">{modal.mode === "create" ? "Add Todo" : "Update Todo"}</h2>
            <input
              autoFocus
              value={modal.title}
              onChange={(event) => setModal((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Todo title"
            />
            <div className="space-y-1 text-sm">
              <label className="font-medium text-slate-600" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                value={modal.status}
                onChange={(event) =>
                  setModal((prev) => (prev ? { ...prev, status: event.target.value } : prev))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 text-sm font-medium">
              <button type="button" onClick={closeModal} className="px-3 py-2 text-slate-500">
                Cancel
              </button>
              <button
                type="button"
                onClick={submitModal}
                disabled={!canSave}
                className={`rounded-xl px-4 py-2 ${
                  canSave ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-400"
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
