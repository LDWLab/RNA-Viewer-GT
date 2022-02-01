import { UiActionsService } from './uiActions';
import { PluginOptions, ApiData} from './data';

export class UiTemplateService {
    private containerElement: HTMLElement;
    private pluginOptions: PluginOptions;
    private uiActionsService: UiActionsService;
    private locations: Map<any, number[]> = new Map();

    constructor(containerElement: HTMLElement, pluginOptions: PluginOptions) {
        this.containerElement = containerElement;
        this.pluginOptions = pluginOptions;
        this.uiActionsService = new UiActionsService(this.pluginOptions.pdbId);
    }

    render(apiData: ApiData, FR3DData: string) {
        this.containerElement.innerHTML = `<div class="pdb-rna-view-container pdb-rna-view-container-${this.pluginOptions.pdbId}">
            ${this.svgTemplate(apiData, FR3DData)}
            ${this.title()}
            ${this.tooltip()}
            ${this.actionButtons()}
        </div>`;
        //this.getJSON(apiData)
        //this.fixOverlaps(apiData)
        this.uiActionsService.applyButtonActions();
    }

    fixOverlaps(apiData: ApiData) {
        var svgEle: any = (<any>document.querySelector(`svg.rnaTopoSvg.rnaTopoSvg_${this.pluginOptions.pdbId}`))
        var xAdjust: number = 0;
        var yAdjust: number = 0;
        apiData.sequence.split('').forEach((char: string, i: number) => {
            if(i === 0 || i === (apiData.sequence.length)) { return }
            let ele = svgEle!.getElementsByClassName(`rnaviewEle rnaviewEle_${this.pluginOptions.pdbId} rnaview_${this.pluginOptions.pdbId}_${apiData.auth_seq_ids[i]}`)[0]
            let nextEle = svgEle!.getElementsByClassName(`rnaviewEle rnaviewEle_${this.pluginOptions.pdbId} rnaview_${this.pluginOptions.pdbId}_${apiData.auth_seq_ids[i + 1]}`)[0]
            nextEle.setAttribute("y", Number(nextEle.getAttribute("y")) + yAdjust)
            nextEle.setAttribute("x", Number(nextEle.getAttribute("x")) + xAdjust)
            let distances = this.getIntersections(ele.getBBox(), nextEle.getBBox())
            if(distances) {
                var lowest = 0;
                for (var j = 1; j < distances.length; j++) {
                    if (distances[j] < distances[lowest]) lowest = j;
                }
                if(lowest === 1) {
                    nextEle.setAttribute("y",Number(nextEle.getAttribute("y")) - Number(distances[1]));
                    yAdjust = yAdjust - Number(distances[1])
                } else if(lowest === 3) {
                    nextEle.setAttribute("y",Number(nextEle.getAttribute("y")) + Number(distances[3]));
                    yAdjust = yAdjust + Number(distances[3])
                } else if(lowest === 0) {
                    nextEle.setAttribute("x",Number(nextEle.getAttribute("x")) - Number(distances[0]));
                    xAdjust = xAdjust - Number(distances[0])
                } else if(lowest === 2) {
                    nextEle.setAttribute("x",Number(nextEle.getAttribute("x")) + Number(distances[2]));
                    xAdjust = xAdjust + Number(distances[2])
                } 
            }
        });
    }

    getIntersections(obj1: any, obj2: any) {
        var left1 = obj1.x
        var right1 = obj1.x + obj1.width
        var top1 = obj1.y
        var bottom1 = obj1.y + obj1.height
        var left2 = obj2.x
        var right2 = obj2.x + obj2.width
        var top2 = obj2.y
        var bottom2 = obj2.y + obj2.height
        if (left1 >= right2 || top1 >= bottom2 ||
            right1 <= left2 || bottom1 <= top2 ) {
          return false
        } else {
          return [right2-left1, bottom2-top1, right1-left2, bottom1-top2]
        }
      }

    calculateFontSize(apiData: ApiData) {
        let xVals: number[] = [];
        let yVals: number[] = [];
        let dist: number[] = [];
        const lastPathIndex = apiData.svg_paths.length - 1;
        apiData.svg_paths.forEach((pathStr: string, recordIndex: number) => {
            if(recordIndex === 0 || recordIndex === lastPathIndex) return;
            let pathStrParsed:string[] = pathStr.split('M').join(',').split(',')
            xVals[recordIndex] = (Number(pathStrParsed[1])+Number(pathStrParsed[3]))/2
            yVals[recordIndex] = (Number(pathStrParsed[2])+Number(pathStrParsed[4]))/2
            if(recordIndex > 1) {
                let xDiff = xVals[recordIndex] - xVals[recordIndex - 1]
                let yDiff = yVals[recordIndex] - yVals[recordIndex - 1]
                dist[recordIndex] = Math.pow((Math.pow(yDiff, 2) + Math.pow(xDiff, 2)),0.5)
            }
        });
        var sortedDist: number[] = dist.sort((a,b) => {return a - b;})
        return 0.9*sortedDist[Math.floor(sortedDist.length * 0.05)]
    }
    
    download(data: any, filename: string, type: string) {
        var file = new Blob([data], {type: type});
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
    /*
    private getJSON(apiData: ApiData){
        let JSON = 
        `{
        "pdbId": ${this.pluginOptions.pdbId},
        "entityId": ${this.pluginOptions.entityId},
        "chainId": ${this.pluginOptions.chainId},
        "nucleotides":[
        `
        const lastPathIndex = apiData.svg_paths.length - 1;
        apiData.svg_paths.forEach((pathStr: string, recordIndex: number) => {
        if(recordIndex === 0 || recordIndex === lastPathIndex) return;
            JSON += 
        `   {"position": ${apiData.auth_seq_ids[recordIndex]}, "value": ${apiData.sequence[recordIndex - 1]}, "x": ${this.locations[recordIndex - 1][0]}, "y": ${this.locations[recordIndex - 1][1]}},
        `
        });
        JSON += 
            `]
        }`
        this.download(JSON, "Test", "JSON")
    }*/
    public static linearlyInterpolate(v0 : number, v1 : number, interpolationFactor : number) : number {
        // See https://en.wikipedia.org/wiki/Linear_interpolation
        return (1 - interpolationFactor) * v0 + interpolationFactor * v1;
    }
    private svgTemplate(apiData: ApiData, FR3DData: string): string {
        let pathStrs: string[] = [];  
        const font_size:number = this.calculateFontSize(apiData)
        const lastPathIndex = apiData.svg_paths.length - 1;
        apiData.svg_paths.forEach((pathStr: string, recordIndex: number) => {
            if(recordIndex === 0 || recordIndex === 1 || recordIndex === (lastPathIndex + 1)) return;
            const pathEleClass = `rnaviewEle rnaviewEle_${this.pluginOptions.pdbId} rnaview_${this.pluginOptions.pdbId}_${apiData.auth_seq_ids[recordIndex - 1]}`;
            let strokeColor = this.pluginOptions.theme?.color || '#323232';
            let isUnobserved = false;
            if(apiData.unobserved_label_seq_ids && apiData.unobserved_label_seq_ids.indexOf(apiData.label_seq_ids[recordIndex - 1]) > -1) {
                strokeColor = this.pluginOptions.theme?.unobservedColor || '#ccc';
                isUnobserved = true;
            }
            let pathStrParsed:string[] = pathStr.split('M').join(',').split(',')
            //let xVal:number = (Number(pathStrParsed[1])+Number(pathStrParsed[3]))/2 
            let xVal:number = Number(pathStrParsed[3]) 
            //let yVal:number = (Number(pathStrParsed[2])+Number(pathStrParsed[4]))/2 
            let yVal:number = Number(pathStrParsed[4])
            this.locations.set(apiData.auth_seq_ids[recordIndex - 1], [xVal, yVal])
            /*pathStrs.push(`<text href="#${pathEleClass}" class="${pathEleClass}" x="${xVal}" y="${yVal}" font-size = "${font_size}px" onclick="UiActionsService.selectPath(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, '${apiData.sequence[recordIndex - 2]}', 'click', ${isUnobserved}, ${this.pluginOptions.theme?.highlightColor ? "'"+this.pluginOptions.theme.highlightColor+"'" : undefined})" 
            onmouseover="UiActionsService.selectPath(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, '${apiData.sequence[recordIndex - 2]}', 'mouseover', ${isUnobserved}, ${this.pluginOptions.theme?.highlightColor ? "'"+this.pluginOptions.theme.highlightColor+"'" : undefined})" 
            onmouseout="UiActionsService.unSelectPath(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, ${isUnobserved}, '${strokeColor}')">${apiData.sequence[recordIndex - 2]}</text>`)
        });*/
        pathStrs.push(
            `<text href="#${pathEleClass}" class="${pathEleClass}" x="${xVal}" y="${yVal}" font-size = "${font_size}px" onclick="UiActionsService.selectNucleotide(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, '${apiData.sequence[recordIndex - 2]}', 'click', ${isUnobserved}, ${this.pluginOptions.theme?.highlightColor ? "'"+this.pluginOptions.theme.highlightColor+"'" : undefined})" 
            onmouseover="UiActionsService.selectNucleotide(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, '${apiData.sequence[recordIndex - 2]}', 'mouseover', ${isUnobserved}, ${this.pluginOptions.theme?.highlightColor ? "'"+this.pluginOptions.theme.highlightColor+"'" : undefined})" 
            onmouseout="UiActionsService.unSelectNucleotide(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, ${isUnobserved}, '${strokeColor}')">${apiData.sequence[recordIndex - 2]}</text>
            <circle class="circle_${this.pluginOptions.pdbId}_${apiData.auth_seq_ids[recordIndex - 1]}" cx="${xVal}" cy="${yVal}" r="${font_size}" display="none" alignment-baseline="middle" stroke-width="${font_size/6}" onclick="UiActionsService.selectNucleotide(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, '${apiData.sequence[recordIndex - 2]}', 'click', ${isUnobserved}, ${this.pluginOptions.theme?.highlightColor ? "'"+this.pluginOptions.theme.highlightColor+"'" : undefined})" 
            onmouseover="UiActionsService.selectNucleotide(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, '${apiData.sequence[recordIndex - 2]}', 'mouseover', ${isUnobserved}, ${this.pluginOptions.theme?.highlightColor ? "'"+this.pluginOptions.theme.highlightColor+"'" : undefined})" 
            onmouseout="UiActionsService.unSelectNucleotide(event, '${this.pluginOptions.pdbId}', ${apiData.auth_seq_ids[recordIndex - 1]}, ${isUnobserved}, '${strokeColor}')"/>`)
        });
        let baseString:string = FR3DData
        let baseArray = (baseString.split('\n')).filter(e =>  e)
        let baseStrs:string[] = []
        let cWW:boolean[] = []
        let tWW:boolean[] = []
        let tHH:boolean[] = []
        let cHH:boolean[] = []
        let cSS:boolean[] = []
        let tSS:boolean[] = []
        baseArray.forEach((baseStr: string) => {
            let chainID1 = baseStr.split(',')[0].split('|')[2]
            let chainID2 = baseStr.split(',')[2].split('|')[2]
            let start:number = +baseStr.split(',')[0].split('|')[4].split('"')[0]
            let end:number = +baseStr.split(',')[2].split('|')[4].split('"')[0]
            if(baseStr && chainID1 == chainID2 && chainID1 == this.pluginOptions.chainId) {
                let type:string = baseStr.split(',')[1].split('"')[1]
                let pathID:string = `rnaviewBP rnaviewBP_${this.pluginOptions.pdbId}_${this.pluginOptions.chainId} ${type}_${start}_${end}`
                let n1: string = baseStr.split(',')[0].split('|')[3]
                let n2: string = baseStr.split(',')[2].split('|')[3]
                let x1 = this.locations.get(start)![0] + font_size/2.5
                let x2 = this.locations.get(end)![0] + font_size/2.5
                let y1 = this.locations.get(start)![1] - font_size/2.5
                let y2 = this.locations.get(end)![1] - font_size/2.5
                let distance = Math.pow(Math.pow((x1-x2),2)+ Math.pow((y1-y2),2),0.5)
                let x1_prime = UiTemplateService.linearlyInterpolate(x1, x2, font_size/distance)
                let y1_prime = UiTemplateService.linearlyInterpolate(y1, y2, font_size/distance)
                let x2_prime = UiTemplateService.linearlyInterpolate(x1, x2, 1-font_size/distance)
                let y2_prime = UiTemplateService.linearlyInterpolate(y1, y2, 1-font_size/distance)
                let stroke = "#ccc"
                if (type.charAt(0) == 't') {
                    var fill = "none"
                } else {
                    var fill = "#ccc"
                }
                let xm = (x1_prime + x2_prime)/2
                let ym = (y1_prime + y2_prime)/2
                let distance2 = distance - 2 * font_size
                let height = font_size/1.5
                if(x1 - x2 != 0) {
                    var phi = 90 + Math.atan2((y1 - y2),(x1-x2)) * 180/Math.PI
                } else {
                    var phi = 0
                }
                if(type == 'cWW' && !(cWW[start] && cWW[end]) && this.locations.get(start)![0] > this.locations.get(end)![0]) {
                    cWW[start] = true
                    cWW[end] = true
                    if(n1 == 'G' && n2 == 'U' || n1 == 'U' && n2 == 'G') {
                        baseStrs.push(`<path class="${pathID}" onmouseover="UiActionsService.showTooltip(evt, '${type} Base Pair <br> Residues ${start}-${n1} and ${end}-${n2}', '${pathID}', '#000', '#000');" onmouseout="UiActionsService.hideTooltip('${pathID}');"
                        d="
                        M ${(x1_prime + x2_prime)/2 - font_size/4}, ${(y1_prime+y2_prime)/2}
                        a ${font_size/4},${font_size/4} 0 1,0 ${font_size/2},0
                        a ${font_size/4},${font_size/4} 0 1,0 ${-1 * font_size/2},0
                        "
                        stroke="#000" stroke-width="${font_size/6} fill="${fill}"
                    />`)
                    } else{
                    baseStrs.push(`<path class="${pathID}" onmouseover="UiActionsService.showTooltip(evt, '${type} Base Pair <br> Residues ${start}-${n1} and ${end}-${n2}', '${pathID}', '#000', '#000');" onmouseout="UiActionsService.hideTooltip('${pathID}');" stroke-width="${font_size/6}" data-stroke-color="#000" stroke="#000" d="M${x1_prime} ${y1_prime} ${x2_prime} ${y2_prime}"></path>`)
                    } 
                } else if (type == 'tWW' && this.locations.get(start)![0] > this.locations.get(end)![0] && !(tWW[start] && tWW[end])) {
                    tWW[start] = true
                    tWW[end] = true
                    let xm1 = UiTemplateService.linearlyInterpolate(x1_prime, (x1_prime + x2_prime)/2, 1-(font_size/3)/(distance/2))
                    let ym1 = UiTemplateService.linearlyInterpolate(y1_prime, (y1_prime + y2_prime)/2, 1-(font_size/3)/(distance/2))
                    let xm2 = UiTemplateService.linearlyInterpolate((x1_prime + x2_prime)/2, x2_prime, (font_size/3)/(distance/2))
                    let ym2 = UiTemplateService.linearlyInterpolate((y1_prime + y2_prime)/2, y2_prime, (font_size/3)/(distance/2))
                    baseStrs.push(`<path class="${pathID}" onmouseover="UiActionsService.showTooltip(evt, '${type} Base Pair <br> Residues ${start}-${n1} and ${end}-${n2}', '${pathID}', '${stroke}', '${fill}');" onmouseout="UiActionsService.hideTooltip('${pathID}');"
                        d="
                        M ${x1_prime} ${y1_prime} ${xm1} ${ym1}
                        M ${(x1_prime + x2_prime)/2 - font_size/3} ${(y1_prime + y2_prime)/2}
                        a ${font_size/3},${font_size/3} 0 1,0 ${font_size/1.5},0
                        a ${font_size/3},${font_size/3} 0 1,0 ${-1 * font_size/1.5},0
                        M ${xm2} ${ym2} ${x2_prime} ${y2_prime}
                        "
                        stroke="${stroke}" stroke-width="${font_size/6}" fill = "${fill}"/>`
                    )
                } else if ((type == 'cSS'&& !(cSS[start] && cSS[end]))||(type == 'tSS' && !(tSS[start] && tSS[end])) && this.locations.get(start)![0] > this.locations.get(end)![0]) {
                    if (type == 'tSS') {
                        tSS[start] = true
                        tSS[end] = true
                    } else {
                        cSS[start] = true
                        cSS[end] = true
                    }
                    baseStrs.push(`<path class="${pathID}" onmouseover="UiActionsService.showTooltip(evt, '${type} Base Pair <br> Residues ${start}-${n1} and ${end}-${n2}', '${pathID}', '${stroke}', '${fill}');" onmouseout="UiActionsService.hideTooltip('${pathID}');"
                    d="
                    M ${xm} ${ym+distance2/2} ${xm} ${ym+height/2} 
                    l ${height/2} 0
                    l -${height/2} -${height} 
                    l -${height/2} ${height}
                    l ${height/2} 0
                    M ${xm} ${ym - height/2} ${xm} ${ym - distance2/2}
                    "stroke="${stroke}" stroke-width="${font_size/6}" fill = "${fill}" transform = "rotate(${phi} ${xm} ${ym})"/>`)
                } else if (type == 'tHS'|| type == 'cHS') {
                    baseStrs.push(`<path class="${pathID}" onmouseover="UiActionsService.showTooltip(evt, '${type} Base Pair <br> Residues ${start}-${n1} and ${end}-${n2}', '${pathID}', '${stroke}', '${fill}');" onmouseout="UiActionsService.hideTooltip('${pathID}');"
                    d="
                    M ${xm} ${ym+distance2/2} ${xm} ${ym + height + height/4} 
                    h -${height/2}
                    v -${height}
                    h ${height}
                    v ${height}
                    h -${height/2}
                    M ${xm} ${ym + height/4} ${xm} ${ym - height/4}
                    l ${height/2} 0
                    l -${height/2} -${height} 
                    l -${height/2} ${height}
                    l ${height/2} 0
                    M ${xm} ${ym - height - height/4} ${xm} ${ym - distance2/2}
                    "stroke="${stroke}" stroke-width="${font_size/6}" fill = "${fill}" transform = "rotate(${phi} ${xm} ${ym})"/>`)
                } else if (type == 'tWS' || type == 'cWS') {
                    baseStrs.push(`<path class="${pathID}" onmouseover="UiActionsService.showTooltip(evt, '${type} Base Pair <br> Residues ${start}-${n1} and ${end}-${n2}', '${pathID}', '${stroke}', '${fill}');" onmouseout="UiActionsService.hideTooltip('${pathID}');"
                    d="
                    M ${xm} ${ym+distance2/2} ${xm} ${ym + height + height/4} 
                    M ${xm - height/2} ${ym + 3*height/4} 
                    a ${height/2},${height/2} 0 1,0 ${height},0
                    a ${height/2},${height/2} 0 1,0 ${-1 * height},0
                    M ${xm} ${ym + height/4} ${xm} ${ym - height/4}
                    l ${height/2} 0
                    l -${height/2} -${height} 
                    l -${height/2} ${height}
                    l ${height/2} 0
                    M ${xm} ${ym - height - height/4} ${xm} ${ym - distance2/2}
                    "stroke="${stroke}" stroke-width="${font_size/6}" fill = "${fill}" transform = "rotate(${phi} ${xm} ${ym})"/>`)
                } else if (type == 'tWH' || type == 'cWH') {
                    baseStrs.push(`<path class="${pathID}" onmouseover="UiActionsService.showTooltip(evt, '${type} Base Pair <br> Residues ${start}-${n1} and ${end}-${n2}', '${pathID}', '${stroke}', '${fill}');" onmouseout="UiActionsService.hideTooltip('${pathID}');"
                    d="
                    M ${xm} ${ym+distance2/2} ${xm} ${ym + height + height/4} 
                    M ${xm - height/2} ${ym + 3*height/4} 
                    a ${height/2},${height/2} 0 1,0 ${height},0
                    a ${height/2},${height/2} 0 1,0 ${-1 * height},0
                    M ${xm} ${ym + height/4} ${xm} ${ym - height/4}
                    h -${height/2}
                    v -${height}
                    h ${height}
                    v ${height}
                    h -${height/2}
                    M ${xm} ${ym - height - height/4} ${xm} ${ym - distance2/2}
                    "stroke="${stroke}" stroke-width="${font_size/6}" fill = "${fill}" transform = "rotate(${phi} ${xm} ${ym})"/>`)
                }
                else if ((type == 'tHH' && !(tHH[start] && tHH[end])) || (type == 'cHH' && !(cHH[start] && cHH[end])) && this.locations.get(start)![0] > this.locations.get(end)![0]) {
                    if (type == 'tHH') {
                        tHH[start] = true
                        tHH[end] = true
                    } else {
                        cHH[start] = true
                        cHH[end] = true
                    }
                    baseStrs.push(`<path class="${pathID}" onmouseover="UiActionsService.showTooltip(evt, '${type} Base Pair <br> Residues ${start}-${n1} and ${end}-${n2}', '${pathID}', '${stroke}', '${fill}');" onmouseout="UiActionsService.hideTooltip('${pathID}');"
                    d="
                    M ${xm} ${ym+distance2/2} ${xm} ${ym+height/2} 
                    h -${height/2}
                    v -${height}
                    h ${height}
                    v ${height}
                    h -${height/2}
                    M ${xm} ${ym - height/2} ${xm} ${ym - distance2/2}
                    "stroke="${stroke}" stroke-width="${font_size/6}" fill = "${fill}" transform = "rotate(${phi} ${xm} ${ym})"/>`)
                }
            }
        });
        return `
        <div style="width:100%;height:100%;z-index:0;position:absolute;">
            <svg preserveAspectRatio="xMidYMid meet" 
            viewBox="0 0 ${apiData.dimensions.width} ${apiData.dimensions.height}" 
            style="width:100%;height:100%;position:relative;">
                <g class="rnaTopoSvgSelection rnaTopoSvgSelection_${this.pluginOptions.pdbId}"></g>
            </svg>
        </div>
        <div style="width:100%;height:100%;z-index:1;position:absolute;">
            <svg preserveAspectRatio="xMidYMid meet"
            viewBox="0 0 ${apiData.dimensions.width} ${apiData.dimensions.height}" 
            style="width:100%;height:100%;position:relative;">
                <g class="rnaTopoSvgHighlight rnaTopoSvgHighlight_${this.pluginOptions.pdbId}"></g>
            </svg>
        </div>
        <div id="tooltip" display="none" style="position:absolute; display: none;"></div> 
        <div style="width:100%;height:100%;z-index:2;position:absolute;">
            <svg class="rnaTopoSvg" preserveAspectRatio="xMidYMid meet" 
                viewBox="0 0 ${apiData.dimensions.width} ${apiData.dimensions.height}" 
                style="width:100%;height:100%;">
                    <g class="rnaTopoSvg_${this.pluginOptions.pdbId}">${pathStrs.join('')}${baseStrs.join('')}</g>
            </svg>
        </div>`;
    }

    private title(): string {
        return  `<span class="pdb-rna-view-title">${this.pluginOptions.pdbId.toUpperCase()} Chain ${this.pluginOptions.chainId}</span>`;
    }

    private tooltip(): string {
        return  `<span class="pdb-rna-view-tooltip" id="${this.pluginOptions.pdbId}-rnaTopologyTooltip"></span>`;
    }

    private actionButtons(): string {
        return  `<div class="pdb-rna-view-btn-group">
            <span class="pdb-rna-view-btn" title="Zoom-in" id="rnaTopologyZoomIn-${this.pluginOptions.pdbId}">
                <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />
                </svg>
            </span>
            
            <span class="pdb-rna-view-btn" title="Zoom-out" id="rnaTopologyZoomOut-${this.pluginOptions.pdbId}">
                <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M15.5,14H14.71L14.43,13.73C15.41,12.59 16,11.11 16,9.5A6.5,6.5 0 0,0 9.5,3A6.5,6.5 0 0,0 3,9.5A6.5,6.5 0 0,0 9.5,16C11.11,16 12.59,15.41 13.73,14.43L14,14.71V15.5L19,20.5L20.5,19L15.5,14M9.5,14C7,14 5,12 5,9.5C5,7 7,5 9.5,5C12,5 14,7 14,9.5C14,12 12,14 9.5,14M7,9H12V10H7V9Z" />
                </svg>
            </span>

            <span class="pdb-rna-view-btn" title="Reset" id="rnaTopologyReset-${this.pluginOptions.pdbId}">
                <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12,6V9L16,5L12,1V4A8,8 0 0,0 4,12C4,13.57 4.46,15.03 5.24,16.26L6.7,14.8C6.25,13.97 6,13 6,12A6,6 0 0,1 12,6M18.76,7.74L17.3,9.2C17.74,10.04 18,11 18,12A6,6 0 0,1 12,18V15L8,19L12,23V20A8,8 0 0,0 20,12C20,10.43 19.54,8.97 18.76,7.74Z" />
                </svg>
            </span>
        </div>`;
    }

    renderError(type?: string) {
        let errorContent = `<div class="pdb-rna-view-error">Error! Something went wrong!</div>`;
        if(type === 'apiError') {
            errorContent = `<div class="pdb-rna-view-error">
                RNA topology data for ${this.pluginOptions.pdbId.toUpperCase()} | ${this.pluginOptions.entityId} | ${this.pluginOptions.chainId.toUpperCase()} is not available!
            </div>`;
        }

        this.containerElement.innerHTML = `<div class="pdb-rna-view-container">${errorContent}</div>`;
    }
}