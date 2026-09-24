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

function SortableCard({ card }: { card: CardType }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card._id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="card"
      style={{
        padding: "0.7rem 0.8rem",
        marginBottom: "0.5rem",
        cursor: "grab",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {card.title}
    </div>
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
  onAddCard: (listId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `list-${listId}` });
  return (
    <div ref={setNodeRef} className="card" style={{ minWidth: 260, padding: "0.8rem", alignSelf: "start" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <SortableContext items={cards.map((c) => c._id)} strategy={verticalListSortingStrategy}>
        {cards.map((card) => (
          <SortableCard key={card._id} card={card} />
        ))}
      </SortableContext>
      <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={() => onAddCard(listId)}>
        + Add card
      </button>
    </div>
  );
}

export function BoardPage() {
  const { workspaceId = "", boardId = "" } = useParams();
  const { data } = useGetBoardQuery({ workspaceId, boardId });
  const [createList] = useCreateListMutation();
  const [createCard] = useCreateCardMutation();
  const [moveCard] = useMoveCardMutation();
  const [newListTitle, setNewListTitle] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (!data) return <p>Loading...</p>;
  const { lists, cards } = data;

  function cardsFor(listId: string) {
    return cards.filter((c) => c.listId === listId).sort((a, b) => a.position - b.position);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
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

  async function handleAddCard(listId: string) {
    const title = window.prompt("Card title");
    if (title?.trim()) {
      await createCard({ workspaceId, boardId, listId, title }).unwrap();
    }
  }

  async function handleAddList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    await createList({ workspaceId, boardId, title: newListTitle }).unwrap();
    setNewListTitle("");
  }

  return (
    <div>
      <h1>{data.board.title}</h1>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem" }}>
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
          <form onSubmit={handleAddList} style={{ minWidth: 220 }}>
            <input
              aria-label="New list title"
              placeholder="+ Add list"
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
              }}
            />
          </form>
        </div>
      </DndContext>
    </div>
  );
}
