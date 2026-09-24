import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

it("renders the fallback instead of crashing when a child throws", () => {
  render(
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <Bomb />
    </ErrorBoundary>,
  );
  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
});
