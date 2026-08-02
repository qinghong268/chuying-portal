interface PlaceholderPageProps {
  title: string;
  note?: string;
}

export function PlaceholderPage({ title, note }: PlaceholderPageProps) {
  return (
    <section>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "1.75rem",
          color: "var(--color-foreground)",
        }}
      >
        {title}
      </h1>
      <p style={{ color: "var(--color-muted-foreground)", marginTop: "var(--space-md)" }}>
        {note ?? "页面占位，后续任务实现完整内容。"}
      </p>
    </section>
  );
}
