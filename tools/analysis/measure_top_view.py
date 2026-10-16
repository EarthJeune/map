from PIL import Image
import numpy as np

img = Image.open('Building Images/R&D Building/Top View rnd.jpg')
w, h = img.size
print('Top View rnd.jpg original size:', w, h)

# Let's inspect the building bounding box in Top View rnd.jpg
# We can sample across the image or inspect
# The building is in the center
# Width is along horizontal (left to right)
# Depth is along vertical (top to bottom)
# In Top View rnd.jpg:
# Left edge of roof is around X = 780 to 850
# Right edge of roof is around X = 3200 to 3300
# Top edge of roof is around Y = 800 to 850
# Bottom edge of roof is around Y = 2100 to 2200

# Let's print out exact pixel coordinates by inspecting corners
# The 4 corner columns in Top View rnd.jpg:
# Top-Left column
# Top-Right column
# Bottom-Left column
# Bottom-Right column
