/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Broad Institute
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import $ from "../vendor/jquery-3.3.1.slim.js"
import TrackBase from "../trackBase.js"
import IGVGraphics from "../igv-canvas.js"
import paintAxis from "../util/paintAxis.js"

const GREEN = "#1fb839"
const YELLOW = "#FFCB1F"
const RED = "#FF0000"

class SplicePredictionTrack extends TrackBase {

    constructor(config, browser) {
        super(config, browser)

        //this.featureType = "numeric"
        this.paintAxis = this.paintAxisCustom
        //this.graphType = "points"
        this.dataRange = {
            min: -1,
            max: 1,
        }
    }

    paintAxisCustom(ctx, pixelWidth, pixelHeight) {
        paintAxis.call(this, ctx, pixelWidth, pixelHeight)

        ctx.fillStyle = "black"
        ctx.font = "bold 10pt sans-serif"
        ctx.textAlign = "center"

        for (const [i, text] of ["GAIN", "LOSS"].entries()) {
            ctx.save()
            ctx.translate(35, pixelHeight * (i == 0 ? 0.25 : 0.75))
            ctx.rotate(-Math.PI/2)
            ctx.fillText(text, 0, 0)
            ctx.restore()
        }
        ctx.translate(15, pixelHeight * 0.5)
        ctx.rotate(-Math.PI/2)
        ctx.font = "12pt sans-serif"
        ctx.fillText("Δ score", 0, 0)
    }

    init(config) {
        super.init(config)

        this.type = config.type || 'spliceprediction'
        this.margin = config.margin === undefined ? 10 : config.margin
        this.height = config.height || 100

        this.features = config.features || []
    }

    get supportsWholeGenome() {
        return true
    }

    async getFeatures(chr, start, end, bpPerPixel) {
        return this.features.filter(feature => feature.chr === chr && feature.start <= end && feature.end >= start)
    };


    /**
     * The required height in pixels required for the track content.   This is not the visible track height, which
     * can be smaller (with a scrollbar) or larger.
     *
     * @param features
     * @returns {*}
     */
    computePixelHeight(features) {
        return this.height
    };

    drawLine(ctx, x0, y0, x1, y1, lineWidth, color) {
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        //ctx.closePath()
        ctx.stroke()
    }

    drawText(ctx, text, x, y, color, fontSize, bold, rotation) {
        ctx.fillStyle = color
        ctx.textAlign = "center"
        if (bold) {
            ctx.font = `bold ${fontSize}pt sans-serif`
        } else {
            ctx.font = `${fontSize}pt sans-serif`
        }
        if (rotation) {
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(rotation)
            const textMeasure = ctx.measureText(text)
            const textCenterOffsetY = (textMeasure.fontBoundingBoxAscent - textMeasure.fontBoundingBoxDescent) / 2
            ctx.translate(0, textCenterOffsetY)
            ctx.fillText(text, 0, 0)
            ctx.restore()
        } else {
            const textMeasure = ctx.measureText(text)
            const textCenterOffsetY = (textMeasure.fontBoundingBoxAscent - textMeasure.fontBoundingBoxDescent) / 2
            ctx.fillText(text, x, y + textCenterOffsetY)
        }
    }


    draw(options) {
        const ctx = options.context
        const pixelWidth = options.pixelWidth
        const pixelHeight = options.pixelHeight
        const bpStart = options.bpStart

        if (!this.config.isMergedTrack) {
            IGVGraphics.fillRect(ctx, 0, options.pixelTop, pixelWidth, pixelHeight, {
                'fillStyle': "rgb(255, 255, 255)"})
        }

        //horizontal line at 0
        this.drawLine(ctx, 0, pixelHeight / 2, pixelWidth, pixelHeight / 2, 0.5, "#777777")

        const threshold = 0.01
        if (options.features) {
            for (let feature of options.features) {
                const bpEnd = bpStart + pixelWidth * options.bpPerPixel + 1
                if (feature.end < bpStart) continue
                if (feature.start > bpEnd) break
                if (Math.abs(feature.AA - feature.RA) >= threshold) {
                    this.renderSplicePredictionScore(feature, options, feature.AA - feature.RA, "A")
                }
                if (Math.abs(feature.AD - feature.RD) >= threshold) {
                    this.renderSplicePredictionScore(feature, options, feature.AD - feature.RD, "D")
                }
            }

        } else {
            console.log("No feature list")
        }

    };

    /**
     * @param feature  feature to render
     * @param options  track options
     * @param score  delta score
     * @param AorD  "A" for splice acceptor, "D" for splice donor
     */
    renderSplicePredictionScore(feature, options, score, AorD) {
        const ctx = options.context
        const bpPerPixel = options.bpPerPixel
        const bpStart = options.bpStart
        const pixelWidth = options.pixelWidth
        const pixelHeight = options.pixelHeight
        ///const bpEnd = bpStart + pixelWidth * bpPerPixel + 1


        const sign = score < 0 ? -1 : 1

        let color
        if (Math.abs(score) >= 0.8) {
            color = RED
        } else if (Math.abs(score) >= 0.5) {
            color = YELLOW
        } else if (Math.abs(score) >= 0.2) {
            color = GREEN
        } else {
            color = "#AAAAAA"
        }

        const scaledScore = score * 0.7
        const xPixel = (feature.start - bpStart - 0.5) / bpPerPixel
        const yPixel = pixelHeight * (1 - scaledScore) / 2

        // draw vertical bar
        this.drawLine(ctx, xPixel, pixelHeight / 2, xPixel, yPixel, 10, color)

        // draw "A" or "D" label
        let rotation
        if (sign > 0) {
            rotation = AorD == "A" ? 0 : -Math.PI / 2
        } else {
            rotation = AorD == "A" ? Math.PI : Math.PI / 2
        }
        this.drawText(ctx, AorD, xPixel, yPixel - sign * pixelHeight * 0.05, "black", 10, true, rotation)

        // draw score label
        this.drawText(ctx, Math.abs(score).toFixed(2), xPixel, yPixel - sign * pixelHeight * 0.12, "black", 9, 0)

    }


    clickedFeatures(clickState) {

        const allFeatures = super.clickedFeatures(clickState)

        return allFeatures.filter(function (feature) {
            return (feature.isVisible && feature.attributes)
        })
    }

    /**
     * Return "popup data" for feature @ genomic location.  Data is an array of key-value pairs
     */
    popupData(clickState, features) {

        if (features === undefined) features = this.clickedFeatures(clickState)
        const genomicLocation = clickState.genomicLocation

        const data = []
        for (let feature of features) {

            const featureData = (typeof feature.popupData === "function") ?
                feature.popupData(genomicLocation) :
                this.extractPopupData(feature._f || feature, this.getGenomeId())

            if (featureData) {
                if (data.length > 0) {
                    data.push("<hr/><hr/>")
                }

                Array.prototype.push.apply(data, featureData)
            }
        }

        return data
    }

    /**
     * Called when the track is removed.  Do any needed cleanup here
     */
    dispose() {
        this.trackView = undefined
    }
}

export default SplicePredictionTrack
