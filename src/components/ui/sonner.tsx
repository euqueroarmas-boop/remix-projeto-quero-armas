import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !border-[#7f2638] !bg-[#252529] !text-[#fff7f8] !shadow-[0_16px_40px_rgba(0,0,0,0.38)]",
          title: "!font-semibold !text-[#fff7f8]",
          description: "!text-[#d8cdd0]",
          icon: "!text-[#c12d49]",
          closeButton:
            "!border-[#7f2638] !bg-[#303035] !text-[#f4e9eb] hover:!bg-[#8f1f35] hover:!text-white",
          actionButton: "!bg-[#8f1f35] !text-white hover:!bg-[#a52841]",
          cancelButton: "!bg-[#38383d] !text-[#f4e9eb] hover:!bg-[#48484e]",
          success: "!border-[#7f2638] !bg-[#252529] !text-[#fff7f8]",
          error: "!border-[#b52a45] !bg-[#252529] !text-[#fff7f8]",
          info: "!border-[#7f2638] !bg-[#252529] !text-[#fff7f8]",
          warning: "!border-[#9f2940] !bg-[#252529] !text-[#fff7f8]",
          loading: "!border-[#7f2638] !bg-[#252529] !text-[#fff7f8]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
