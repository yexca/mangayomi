package media

import (
	"image"
	"image/color"
)

// shrink box-averages src by the integer factor f. A kernel scaler that
// downsamples a full page antialiases by visiting every source pixel with
// many taps, which costs about as much as decoding the page; averaging the
// raw planes visits each pixel once. Trailing rows and columns that do not
// fill a block are dropped. Pixel formats without a plane fast path, and
// images too small to shrink, are returned unchanged.
func shrink(src image.Image, f int) image.Image {
	b := src.Bounds()
	w, h := b.Dx()/f, b.Dy()/f
	if f < 2 || w == 0 || h == 0 {
		return src
	}
	switch m := src.(type) {
	case *image.YCbCr:
		return shrinkYCbCr(m, f)
	case *image.Gray:
		pix := boxPlane(m.Pix[m.PixOffset(b.Min.X, b.Min.Y):], m.Stride, w, h, f, 1)
		return &image.Gray{Pix: pix, Stride: w, Rect: image.Rect(0, 0, w, h)}
	case *image.RGBA:
		pix := boxPlane(m.Pix[m.PixOffset(b.Min.X, b.Min.Y):], m.Stride, w, h, f, 4)
		return &image.RGBA{Pix: pix, Stride: 4 * w, Rect: image.Rect(0, 0, w, h)}
	case *image.NRGBA:
		pix := boxPlane(m.Pix[m.PixOffset(b.Min.X, b.Min.Y):], m.Stride, w, h, f, 4)
		return &image.NRGBA{Pix: pix, Stride: 4 * w, Rect: image.Rect(0, 0, w, h)}
	}
	return src
}

// boxPlane averages f×f blocks of an interleaved plane with ch channels
// per pixel into a w×h plane.
func boxPlane(pix []byte, stride, w, h, f, ch int) []byte {
	out := make([]byte, w*h*ch)
	sums := make([]uint32, w*ch)
	n := uint32(f * f)
	for oy := 0; oy < h; oy++ {
		clear(sums)
		for y := oy * f; y < oy*f+f; y++ {
			row := pix[y*stride : y*stride+w*f*ch]
			i := 0
			for ox := 0; ox < w; ox++ {
				s := sums[ox*ch : ox*ch+ch]
				for k := 0; k < f; k++ {
					for c := range s {
						s[c] += uint32(row[i])
						i++
					}
				}
			}
		}
		o := out[oy*w*ch : (oy+1)*w*ch]
		for i, s := range sums {
			o[i] = byte((s + n/2) / n)
		}
	}
	return out
}

// shrinkYCbCr averages the luma and chroma planes separately, whatever
// their subsampling, and converts the result to RGBA.
func shrinkYCbCr(m *image.YCbCr, f int) image.Image {
	b := m.Rect
	w, h := b.Dx()/f, b.Dy()/f
	c0 := m.COffset(b.Min.X, b.Min.Y)
	cw := m.COffset(b.Max.X-1, b.Min.Y) - c0 + 1
	chh := (m.COffset(b.Min.X, b.Max.Y-1)-c0)/m.CStride + 1
	cow, coh := cw/f, chh/f
	if cow == 0 || coh == 0 {
		return m
	}
	ys := boxPlane(m.Y[m.YOffset(b.Min.X, b.Min.Y):], m.YStride, w, h, f, 1)
	cbs := boxPlane(m.Cb[c0:], m.CStride, cow, coh, f, 1)
	crs := boxPlane(m.Cr[c0:], m.CStride, cow, coh, f, 1)

	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		cy := min(y*coh/h, coh-1) * cow
		for x := 0; x < w; x++ {
			ci := cy + min(x*cow/w, cow-1)
			r, g, bl := color.YCbCrToRGB(ys[y*w+x], cbs[ci], crs[ci])
			i := y*dst.Stride + 4*x
			dst.Pix[i], dst.Pix[i+1], dst.Pix[i+2], dst.Pix[i+3] = r, g, bl, 255
		}
	}
	return dst
}
