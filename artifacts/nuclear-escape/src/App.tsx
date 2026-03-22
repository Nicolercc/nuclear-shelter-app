import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import NuclearEscapeRouter from "@/pages/NuclearEscapeRouter";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NuclearEscapeRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
