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

const REFERENCE_SCORE_COLOR = "#0000B4"
const ALTERNATE_SCORE_COLOR = "#05d0d2"

class SplicePredictionTrack extends TrackBase {

    constructor(config, browser) {
        super(config, browser)

        this.tool = config.tool || "SpliceAI"
        this.rawOrDelta = config.rawOrDelta || "delta"
        this.strand = config.strand || "+"
        this.paintAxis = this.paintAxisCustom
        this.dataRange = this.rawOrDelta === "delta" ? {
            min: -1,
            max: 1,
        } : {
            min: 0,
            max: 1,
        }
    }

    paintAxisCustom(ctx, pixelWidth, pixelHeight) {
        paintAxis.call(this, ctx, pixelWidth, pixelHeight)

        ctx.fillStyle = "black"
        ctx.font = "bold 10pt sans-serif"
        ctx.textAlign = "center"

        if (this.rawOrDelta == "delta") {
            for (const [i, text] of ["GAIN", "LOSS"].entries()) {
                ctx.save()
                ctx.translate(35, pixelHeight * (i == 0 ? 0.25 : 0.75))
                ctx.rotate(-Math.PI / 2)
                ctx.fillText(text, 0, 0)
                ctx.restore()
            }
            ctx.translate(15, pixelHeight * 0.5)
            ctx.rotate(-Math.PI/2)
            ctx.font = "12pt sans-serif"
            ctx.fillText(`${this.tool}: Δ`, 0, 0)
        } else {
            ctx.translate(15, pixelHeight * 0.5)
            ctx.rotate(-Math.PI/2)
            ctx.font = "12pt sans-serif"
            ctx.fillText(`${this.tool}: raw`, 0, 0)
        }

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
    }


    /**
     * The required height in pixels required for the track content.   This is not the visible track height, which
     * can be smaller (with a scrollbar) or larger.
     *
     * @param features
     * @returns {*}
     */
    computePixelHeight(features) {
        return this.height
    }

    drawLine(ctx, x0, y0, x1, y1, lineWidth, color, dashed) {
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        if (dashed) {
            ctx.setLineDash([3, 4])
        } else {
            ctx.setLineDash([])
        }
        ctx.lineTo(x1, y1)
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

    round(value, decimals = 2) {
        return parseFloat(parseFloat(value).toFixed(decimals))
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

        if (this.rawOrDelta == "delta") {
            //horizontal line at 0
            this.drawLine(ctx, 0, pixelHeight / 2, pixelWidth, pixelHeight / 2, 0.5, "#777777", false)
        } else {
            //horizontal lines at 0.2, 0.5, 0.8
            this.drawLine(ctx, 0, 0, pixelWidth, 0, 0.5, "#777777", false)
            this.drawLine(ctx, 0, pixelHeight, pixelWidth, pixelHeight, 0.5, "#777777", false)
            this.drawLine(ctx, 0, pixelHeight * 0.2, pixelWidth, pixelHeight * 0.2, 0.5, RED, true)
            this.drawLine(ctx, 0, pixelHeight * 0.5, pixelWidth, pixelHeight * 0.5, 0.5, YELLOW, true)
            this.drawLine(ctx, 0, pixelHeight * 0.8, pixelWidth, pixelHeight * 0.8, 0.5, GREEN, true)
        }


        const threshold = 0.01

        if (options.features) {
            for (let feature of options.features) {
                const bpEnd = bpStart + pixelWidth * options.bpPerPixel + 1
                if (feature.end < bpStart || feature.start > bpEnd) continue
                if (this.tool.toLowerCase() == "spliceai") {
                    if ((this.rawOrDelta == "delta") && (Math.abs(this.round(feature.AA - feature.RA)) >= threshold) ||
                        (this.rawOrDelta != "delta") && (Math.abs(this.round(feature.AA)) >= threshold || Math.abs(this.round(feature.RA)) >= threshold)) {
                        //render acceptor score
                        this.renderScore(feature, options, feature.RA, feature.AA, "A")
                    }
                    if ((this.rawOrDelta == "delta") && (Math.abs(this.round(feature.AD - feature.RD)) >= threshold) ||
                        (this.rawOrDelta != "delta") && (Math.abs(this.round(feature.AD)) >= threshold || Math.abs(this.round(feature.RD)) >= threshold)) {
                        //render donor score
                        this.renderScore(feature, options, feature.RD, feature.AD, "D")
                    }
                } else if ((this.tool.toLowerCase() == "pangolin") && (this.rawOrDelta == "delta")) {
                    if (this.round(feature.SL_ALT - feature.SL_REF) <= -threshold) {
                        //render splice loss score
                        this.renderScore(feature, options, feature.SL_REF, feature.SL_ALT, "P")
                    } else if (this.round(feature.SG_ALT - feature.SG_REF) >= threshold) {
                        //render splice gain score
                        this.renderScore(feature, options, feature.SG_REF, feature.SG_ALT, "P")
                    }
                }
            }
        } else {
            console.log("No feature list")
        }
    }


    /**
     * @param feature  feature to render
     * @param options  track options
     * @param score  delta score
     * @param AorDorP  "A" for splice acceptor, "D" for splice donor
     */
    renderScore(feature, options, refScore, altScore, AorDorP) {
        const score = this.round(altScore - refScore)
        const ctx = options.context
        const bpPerPixel = options.bpPerPixel
        const bpStart = options.bpStart
        //const pixelWidth = options.pixelWidth
        const pixelHeight = options.pixelHeight
        ///const bpEnd = bpStart + pixelWidth * bpPerPixel + 1


        const sign = score < 0 ? -1 : 1

        // draw "A" or "D" label
        let rotation = 0
        if (sign > 0) {
            rotation = AorDorP == "A" ? 0 : -Math.PI / 2
        } else {
            rotation = AorDorP == "A" ? Math.PI : Math.PI / 2
        }

        let shift = 0
        if (AorDorP == "D") {
            shift = this.strand == "-" ? 1 : 0
        } else if (AorDorP == "A") {
            shift = this.strand == "-" ? 0 : 1
        } else if (AorDorP == "P") {
            shift = 0.5
        } else {
            console.error(`Unexpected value for AorDorP arg: ${AorDorP}`)
        }

        const xPixel = (feature.start - bpStart - shift) / bpPerPixel
        const textMeasure = ctx.measureText("A")
        const labelHeight = (textMeasure.fontBoundingBoxAscent + textMeasure.fontBoundingBoxDescent) / 2
        if (this.rawOrDelta == "delta") {
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

            const scaledScore = score * 0.65    // rescale the score range to provide room for labels
            const yPixel = pixelHeight * (1 - scaledScore) / 2

            // draw vertical bar
            const lineWidth = Math.max(0.5, 1/bpPerPixel)
            this.drawLine(ctx, xPixel, pixelHeight / 2, xPixel, yPixel, lineWidth, color, false)
            // draw "A" or "D" label
            this.drawText(ctx, AorDorP, xPixel, yPixel - sign * 1.5 * labelHeight, "black", 10, lineWidth > 1, rotation)
            // draw score
            const scoreLabel = parseFloat(this.tool.toLowerCase() == "pangolin" ? score.toFixed(2) : Math.abs(score).toFixed(2))
            this.drawText(ctx, scoreLabel, xPixel, yPixel - sign * 2 * labelHeight * 2, "black", 9, 0)

        } else {
            const yPixelValues = []
            for (const [i, score] of [altScore, refScore].entries()) {

                const yPixelMargin = labelHeight
                let yPixel = pixelHeight * (1 - score)
                if (yPixel > pixelHeight - yPixelMargin) {
                    yPixel = pixelHeight - yPixelMargin
                }
                if (yPixel < yPixelMargin) {
                    yPixel = yPixelMargin
                }

                let color
                if (i == 1) {
                    color = REFERENCE_SCORE_COLOR

                    // draw ref score
                    const scoreLabel = parseFloat(Math.abs(score).toFixed(2))
                    const yPixelScoreLabel = yPixel - (refScore > 0.5 ? -1 : 1) * 1.3 * labelHeight * 2
                    this.drawText(ctx, scoreLabel, xPixel, yPixelScoreLabel, color, 9, 0)

                    yPixelValues.push(
                        Math.abs(yPixelValues[0] - yPixel) < Math.abs(yPixelValues[0] - yPixelScoreLabel) ?
                            yPixel : yPixelScoreLabel)

                } else {
                    color = ALTERNATE_SCORE_COLOR

                    yPixelValues.push(yPixel)
                }

                const labelsOverlap = yPixelValues.length >= 2 && (Math.abs(yPixelValues[0] - yPixelValues[1]) < 10)

                if (i == 1 && !labelsOverlap) {
                    // draw vertical line
                    const lineWidth = 1
                    this.drawLine(
                        ctx,
                        xPixel,
                        Math.min(yPixelValues[0], yPixelValues[1]) + labelHeight * 1.3,
                        xPixel, Math.max(yPixelValues[0], yPixelValues[1]) - labelHeight * 1.3,
                        lineWidth,
                        color,
                        true)
                }
                // draw "A" or "D" label
                this.drawText(ctx, AorDorP, xPixel + ((i == 1 && labelsOverlap) ? 2 : 0), yPixel, color, 10, true, rotation)

            }

        }

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
