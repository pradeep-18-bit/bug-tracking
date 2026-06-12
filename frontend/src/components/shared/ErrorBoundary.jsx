import React from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <Card className="w-full max-w-md border-rose-200 bg-rose-50/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                <AlertCircle className="h-6 w-6 text-rose-600" />
              </div>
              <CardTitle className="text-rose-900">Something went wrong</CardTitle>
              <CardDescription className="text-rose-700">
                An unexpected error occurred while rendering this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-md bg-rose-100/50 p-3 text-xs font-mono text-rose-800">
                {this.state.error?.message || "Unknown error"}
              </div>
              <Button
                variant="outline"
                className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                onClick={this.handleReset}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
