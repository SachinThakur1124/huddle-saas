import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useGetBoardQuery,
  useCreateListMutation,
  useCreateCardMutation,
  useMoveCardMutation,
  Card as CardType,
} from "./boardsApi";
import { getErrorMessage } from "../../app/errors";

const TITLE_MAX = 100;

function SortableCard({ card }: { card: CardType }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card._id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="card board-card"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {card.title}
    </div>
  );
}

function AddCardForm({ listId, onSubmit }: { listId: string; onSubmit: (listId: string, title: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={() => setOpen(true)}>
        + Add card
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    setError("");
    const ok = await onSubmit(listId, title.trim());
    setIsSubmitting(false);
    if (ok) {
      setTitle("");
      setOpen(false);
    } else {
      setError("Couldn't add the card. Check your permissions and try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        autoFocus
        aria-label="New card title"
        className="new-list-input"
        placeholder="Card title"
        maxLength={TITLE_MAX}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {error && <p className="field-error">{error}</p>}
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
        <button className="btn" type="submit" disabled={isSubmitting || !title.trim()}>
          Add
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setError("");
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ListColumn({
  listId,
  title,
  cards,
  onAddCard,
}: {
  listId: string;
  title: string;
  cards: CardType[];
  onAddCard: (listId: string, title: string) => Promise<boolean>;
}) {
  const { setNodeRef } = useDroppable({ id: `list-${listId}` });
  return (
    <div ref={setNodeRef} className="card board-column">
      <div className="board-column-header">
        <h3>{title}</h3>
        <span className="badge">{cards.length}</span>
      </div>
      <div className="board-column-body">
        <SortableContext items={cards.map((c) => c._id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card._id} card={card} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.2rem 0 0.7rem" }}>
            No cards yet
          </p>
        )}
        <AddCardForm listId={listId} onSubmit={onAddCard} />
      </div>
    </div>
  );
}

export function BoardPage() {
  const { workspaceId = "", boardId = "" } = useParams();
  const { data, isError, isLoading } = useGetBoardQuery({ workspaceId, boardId });
  const [createList] = useCreateListMutation();
  const [createCard] = useCreateCardMutation();
  const [moveCard] = useMoveCardMutation();
  const [newListTitle, setNewListTitle] = useState("");
  const [listError, setListError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (isLoading) {
    return (
      <div className="loading-row">
        <span className="spinner" /> Loading board...
      </div>
    );
  }
  if (isError || !data) {
    return <div className="alert alert-error">This board doesn't exist or you don't have access to it.</div>;
  }
  const { lists, cards } = data;

  function cardsFor(listId: string) {
    return cards.filter((c) => c.listId === listId).sort((a, b) => a.position - b.position);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || over.id === active.id) return;
    const activeCard = cards.find((c) => c._id === active.id);
    if (!activeCard) return;

    let toListId: string;
    let toPosition: number;

    if (typeof over.id === "string" && over.id.startsWith("list-")) {
      toListId = over.id.slice("list-".length);
      toPosition = cardsFor(toListId).length;
    } else {
      const overCard = cards.find((c) => c._id === over.id);
      if (!overCard) return;
      toListId = overCard.listId;
      toPosition = cardsFor(toListId).findIndex((c) => c._id === overCard._id);
    }

    if (toListId === activeCard.listId && toPosition === activeCard.position) return;
    moveCard({ workspaceId, boardId, cardId: activeCard._id, toListId, toPosition });
  }

  async function handleAddCard(listId: string, title: string): Promise<boolean> {
    try {
      await createCard({ workspaceId, boardId, listId, title }).unwrap();
      return true;
    } catch {
      return false;
    }
  }

  async function handleAddList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    setListError("");
    try {
      await createList({ workspaceId, boardId, title: newListTitle.trim() }).unwrap();
      setNewListTitle("");
    } catch (err) {
      setListError(getErrorMessage(err, "Couldn't create the list. Check your permissions and try again."));
    }
  }

  return (
    <div>
      <h1>{data.board.title}</h1>
      {listError && <div className="alert alert-error">{listError}</div>}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="board-track">
          {lists
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((list) => (
              <ListColumn
                key={list._id}
                listId={list._id}
                title={list.title}
                cards={cardsFor(list._id)}
                onAddCard={handleAddCard}
              />
            ))}
          <form onSubmit={handleAddList} className="board-add-list">
            <input
              aria-label="New list title"
              placeholder="+ Add list"
              className="new-list-input"
              maxLength={TITLE_MAX}
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
            />
          </form>
        </div>
      </DndContext>
    </div>
  );
}
