print("Reading input...")

local input = select(1, ...)
local output = select(2, ...)

local content = fs.read(input, "rbxm")

print("Writing output...")
fs.write(output, content, "rbxmx")
print("Done.")
