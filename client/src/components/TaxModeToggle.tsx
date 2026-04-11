import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const options = [
  { key: "white", label: "白色申告" },
  { key: "blue", label: "青色申告" },
] as const;

export default function TaxModeToggle() {
  const { taxMode, setTaxMode } = useTheme();

  return (
    <div className="inline-flex rounded-2xl border border-border/70 bg-background/80 p-1 shadow-sm backdrop-blur">
      {options.map(option => {
        const isActive = taxMode === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => setTaxMode(option.key)}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
